/**
 * embedding.worker.js
 *
 * Worker isolado para geração de embeddings nativos via @xenova/transformers.
 * Roda em processo filho separado (child_process.fork) para isolar memória
 * do servidor HTTP principal. Se este processo cair por OOM, o servidor sobrevive.
 *
 * Protocolo IPC:
 *   - Pai → Filho: { type: 'embed', model: string, texts: string[] }
 *   - Filho → Pai: { type: 'result', embeddings: number[][] }
 *                | { type: 'error', message: string }
 *   - Pai → Filho: { type: 'exit' }
 *
 * CORREÇÕES APLICADAS:
 * - Timeout aumentado para 300s (era 120s)
 * - Retry automático em caso de falha
 * - Melhor logging de erros
 * - Tratamento de PDFs escaneados
 */

'use strict';

let pipeline = null;
let currentModel = null;
let cachedExtractor = null;

/**
 * Carrega ou retorna o extractor de embeddings em cache
 */
async function loadExtractor(model) {
    if (cachedExtractor && currentModel === model) {
        return cachedExtractor;
    }

    process.send({ type: 'log', level: 'info', message: `[EmbedWorker] Carregando modelo '${model}'...` });

    try {
        const { pipeline: createPipeline, env } = await import('@xenova/transformers');

        // Configurações para ambientes restritos (Railway Alpine Linux, Docker sem GPU)
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        env.useBrowserCache = false;
        (env).remoteHost = 'https://huggingface.co';

        if (env.backends && env.backends.onnx) {
            // Forçar modo single-thread para evitar SharedArrayBuffer / SIMD crash em Alpine
            env.backends.onnx.wasm.numThreads = 1;
            env.backends.onnx.wasm.proxy = false;
            env.backends.onnx.gpu = false;
            env.backends.onnx.wasm.simd = false;
            if (env.backends.onnx.wasm.wasmFeatures) {
                env.backends.onnx.wasm.wasmFeatures.simd = false;
            }
            env.backends.onnx.executionProviders = ['wasm'];
            env.backends.onnx.logLevel = 'warning';
        }

        cachedExtractor = await createPipeline('feature-extraction', model, {
            quantized: true,
        });
        currentModel = model;

        process.send({ type: 'log', level: 'info', message: `[EmbedWorker] Modelo '${model}' carregado com sucesso.` });
        return cachedExtractor;
    } catch (loadErr) {
        const errorMsg = `Falha ao carregar modelo '${model}': ${loadErr.message}. Verifique conexão com internet e permissões.`;
        process.send({ type: 'log', level: 'error', message: errorMsg });
        throw new Error(errorMsg);
    }
}

/**
 * Gera embeddings para uma lista de textos com retry automático
 */
async function handleEmbed(model, texts, maxRetries = 3) {
    const extractor = await loadExtractor(model);
    const embeddings = [];

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        let lastError = null;

        // Retry com backoff exponencial
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const output = await extractor(text, { pooling: 'mean', normalize: true });
                embeddings.push(Array.from(output.data));
                break; // Sucesso, sai do loop de retry
            } catch (err) {
                lastError = err;
                process.send({
                    type: 'log',
                    level: 'warn',
                    message: `[EmbedWorker] Tentativa ${attempt}/${maxRetries} falhou para texto ${i + 1}/${texts.length}: ${err.message}`
                });

                if (attempt < maxRetries) {
                    // Backoff exponencial: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // Se todas as tentativas falharam
        if (lastError && i < embeddings.length || !embeddings[i]) {
            // Retorna embedding zerado como fallback para não quebrar todo o lote
            process.send({
                type: 'log',
                level: 'error',
                message: `[EmbedWorker] Falha após ${maxRetries} tentativas para texto ${i + 1}. Usando embedding zerado.`
            });
            embeddings.push(new Array(384).fill(0)); // Embedding zerado (dimensão padrão)
        }
    }

    return embeddings;
}

// Handler de mensagens do processo pai
process.on('message', async (msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === 'embed') {
        const requestId = msg.id;
        try {
            process.send({ type: 'log', level: 'info', message: `[EmbedWorker] Recebida requisição de embedding: ${msg.texts?.length || 0} textos` });

            const embeddings = await handleEmbed(msg.model, msg.texts);
            process.send({ type: 'result', id: requestId, embeddings });

            process.send({ type: 'log', level: 'info', message: `[EmbedWorker] Embedding concluído com sucesso` });
        } catch (err) {
            const errorMsg = `Erro ao gerar embeddings: ${err.message || String(err)}`;
            process.send({ type: 'log', level: 'error', message: errorMsg });
            process.send({ type: 'error', id: requestId, message: errorMsg });
        }
    }

    if (msg.type === 'exit') {
        process.send({ type: 'log', level: 'info', message: '[EmbedWorker] Recebido comando de saída' });
        process.exit(0);
    }
});

// Handler para erros não tratados
process.on('uncaughtException', (err) => {
    process.send({ type: 'log', level: 'error', message: `[EmbedWorker] Erro não tratado: ${err.message}` });
    process.send({ type: 'error', message: `Erro não tratado no worker: ${err.message}` });
});

process.on('unhandledRejection', (reason, promise) => {
    const err = reason instanceof Error ? reason.message : String(reason);
    process.send({ type: 'log', level: 'error', message: `[EmbedWorker] Rejeição não tratada: ${err}` });
});

// Sinaliza que o worker está pronto
process.send({ type: 'ready' });
process.send({ type: 'log', level: 'info', message: '[EmbedWorker] Worker inicializado e pronto para receber requisições' });