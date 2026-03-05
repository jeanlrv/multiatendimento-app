import { Injectable, Logger } from '@nestjs/common';
import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import { spawn } from 'child_process';
import { join } from 'path';

/**
 * PythonEmbeddings
 *
 * Implementação de embeddings usando Python subprocesso (sentence-transformers).
 * Usado como fallback para evitar crash do ONNX no Railway Alpine Linux.
 *
 * O script Python (embedding.py) carrega o modelo na primeira execução e mantém
 * em cache para requisições subsequentes.
 */
@Injectable()
export class PythonEmbeddings extends Embeddings {
    private readonly logger = new Logger(PythonEmbeddings.name);
    private pythonPath: string;
    private scriptPath: string;
    private model: string;

    constructor(params?: EmbeddingsParams) {
        super(params);
        this.pythonPath = process.env.PYTHON_PATH || 'python3';
        this.scriptPath = join(process.cwd(), 'backend', 'embedding.py');
        this.model = 'paraphrase-MiniLM-L6-v2';
    }

    /**
     * Gera embeddings para múltiplos documentos
     */
    async embedDocuments(documents: string[]): Promise<number[][]> {
        const embeddings: number[][] = [];
        for (const doc of documents) {
            const emb = await this.embedQuery(doc);
            embeddings.push(emb);
        }
        return embeddings;
    }

    /**
     * Gera embedding para uma única query
     */
    async embedQuery(query: string): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const timeoutMs = 60000; // 60 segundos
            let timedOut = false;

            const timeout = setTimeout(() => {
                timedOut = true;
                reject(new Error(`Timeout (${timeoutMs / 1000}s) ao gerar embedding via Python`));
            }, timeoutMs);

            const child = spawn(this.pythonPath, [this.scriptPath, query], {
                timeout: timeoutMs,
                env: { ...process.env },
            });

            if (!child.stdout || !child.stderr) {
                reject(new Error('Falha ao criar pipes de stdout/stderr'));
                return;
            }

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
                this.logger.debug(`[PythonEmbed stderr] ${data.toString()}`);
            });

            child.on('close', (code) => {
                clearTimeout(timeout);

                if (timedOut) return;

                if (code !== 0) {
                    const errorMsg = `Python embedding falhou (code=${code}): ${stderr || stdout}`;
                    this.logger.error(`[PythonEmbed] ${errorMsg}`);
                    reject(new Error(errorMsg));
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    if (result.success && result.embedding) {
                        resolve(result.embedding);
                    } else {
                        reject(new Error(`Python embedding falhou: ${result.error || 'Resposta inválida'}`));
                    }
                } catch (parseError) {
                    this.logger.error(`[PythonEmbed] Erro ao parsear resposta JSON: ${parseError.message}`);
                    reject(new Error(`Falha ao parsear resposta do embedding Python: ${parseError.message}`));
                }
            });

            child.on('error', (err) => {
                clearTimeout(timeout);
                if (!timedOut) {
                    this.logger.error(`[PythonEmbed] Erro ao spawnar processo: ${err.message}`);
                    reject(new Error(`Falha ao inicializar processo Python: ${err.message}`));
                }
            });
        });
    }

    /**
     * Retorna o número de dimensões do embedding
     */
    async instructions() {
        return { dimensions: 384 };
    }
}
