/**
 * Circuit Breaker simples para chamadas a APIs externas (OpenAI, Z-API, etc.)
 *
 * Estados:
 *  CLOSED  → funcionamento normal, requisições passam.
 *  OPEN    → muitas falhas recentes, requisições são rejeitadas imediatamente.
 *  HALF_OPEN → após cooldown, uma requisição de teste é deixada passar.
 *
 * Uso:
 *   const cb = new CircuitBreaker('openai', { failureThreshold: 5, cooldownMs: 30_000 });
 *   const result = await cb.exec(() => openaiClient.chat(...));
 */

export interface CircuitBreakerOptions {
    /** Número de falhas consecutivas para abrir o circuito. Default: 5 */
    failureThreshold?: number;
    /** Tempo em ms antes de tentar HALF_OPEN. Default: 30_000 (30s) */
    cooldownMs?: number;
    /** Timeout em ms por chamada. Se excedido, conta como falha. Default: 15_000 (15s) */
    timeoutMs?: number;
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failures = 0;
    private lastFailureAt = 0;

    private readonly failureThreshold: number;
    private readonly cooldownMs: number;
    private readonly timeoutMs: number;
    private readonly name: string;

    constructor(name: string, options: CircuitBreakerOptions = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.cooldownMs = options.cooldownMs ?? 30_000;
        this.timeoutMs = options.timeoutMs ?? 15_000;
    }

    get currentState(): CircuitState {
        return this.state;
    }

    async exec<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            const elapsed = Date.now() - this.lastFailureAt;
            if (elapsed < this.cooldownMs) {
                throw new Error(`[CircuitBreaker:${this.name}] Circuito ABERTO — aguardando ${Math.ceil((this.cooldownMs - elapsed) / 1000)}s antes de tentar novamente.`);
            }
            // Tenta HALF_OPEN
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await this.withTimeout(fn);
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`[CircuitBreaker:${this.name}] Timeout após ${this.timeoutMs}ms`));
            }, this.timeoutMs);

            fn()
                .then((result) => { clearTimeout(timer); resolve(result); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });
    }

    private onSuccess() {
        this.failures = 0;
        this.state = 'CLOSED';
    }

    private onFailure() {
        this.failures++;
        this.lastFailureAt = Date.now();

        if (this.failures >= this.failureThreshold || this.state === 'HALF_OPEN') {
            this.state = 'OPEN';
        }
    }

    reset() {
        this.state = 'CLOSED';
        this.failures = 0;
        this.lastFailureAt = 0;
    }
}

/**
 * Registry global de circuit breakers por nome de serviço.
 * Permite reutilizar a mesma instância em todo o processo.
 */
const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!registry.has(name)) {
        registry.set(name, new CircuitBreaker(name, options));
    }
    return registry.get(name)!;
}
