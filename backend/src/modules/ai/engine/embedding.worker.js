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
 */

'use strict';

let pipeline = null;
let currentModel = null;
let cachedExtractor = null;

async function loadExtractor(model) {
    if (cachedExtractor && currentModel === model) {
        return cachedExtractor;
    }

    process.send({ type: 'log', level: 'info', message: `[EmbedWorker] Carregando modelo '${model}'...` });

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
}

async function handleEmbed(model, texts) {
    const extractor = await loadExtractor(model);
    const embeddings = [];

    for (const text of texts) {
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        embeddings.push(Array.from(output.data));
    }

    return embeddings;
}

process.on('message', async (msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === 'embed') {
        try {
            const embeddings = await handleEmbed(msg.model, msg.texts);
            process.send({ type: 'result', id: msg.id, embeddings });
        } catch (err) {
            process.send({ type: 'error', id: msg.id, message: err.message || String(err) });
        }
    }

    if (msg.type === 'exit') {
        process.exit(0);
    }
});

// Sinaliza que o worker está pronto
process.send({ type: 'ready' });
