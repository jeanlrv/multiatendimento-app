import { Injectable, Logger } from '@nestjs/common';
import { ActionExecutor, WorkflowContext, ActionResult } from '../interfaces/action-executor.interface';
import axios from 'axios';

/**
 * Lista de padrões de hostname bloqueados para prevenir SSRF (Server-Side Request Forgery)
 * Bloqueia acesso a recursos internos, locais e privados da rede.
 */
const BLOCKED_HOSTNAME_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^0\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,          // link-local
    /^fc00:/i,              // IPv6 ULA
    /^fd[0-9a-f]{2}:/i,    // IPv6 ULA
    /^::1$/,                // IPv6 loopback
    /^fe80:/i,              // IPv6 link-local
];

/**
 * Lista de protocolos permitidos para prevenir ataques de SSRF via protocol handlers
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Valida se uma URL está segura para requisições externas (proteção SSRF)
 * @param rawUrl URL bruta a ser validada
 * @returns true se a URL for bloqueada, false se for segura
 */
function isSsrfBlockedUrl(rawUrl: string): boolean {
    try {
        const parsedUrl = new URL(rawUrl);

        // Verificar protocolo
        if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
            return true;
        }

        // Verificar hostname contra padrões bloqueados
        if (BLOCKED_HOSTNAME_PATTERNS.some((p) => p.test(parsedUrl.hostname))) {
            return true;
        }

        // Verificar se o hostname é um IP numérico
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(parsedUrl.hostname)) {
            // Verificar se é IP privado
            const ipParts = parsedUrl.hostname.split('.').map(Number);
            if (
                ipParts[0] === 10 ||
                (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) ||
                (ipParts[0] === 192 && ipParts[1] === 168) ||
                ipParts[0] === 127 ||
                ipParts[0] === 0
            ) {
                return true;
            }
        }

        return false;
    } catch {
        return true; // URL inválida = bloquear
    }
}

@Injectable()
export class HttpWebhookAction implements ActionExecutor {
    private readonly logger = new Logger(HttpWebhookAction.name);

    async execute(context: WorkflowContext, params: any): Promise<ActionResult> {
        this.logger.log(`Executing HttpWebhookAction for workflow ${context.workflowId}`);

        const { url, method = 'POST', headers = {}, body = {} } = params;

        if (!url) {
            return { success: false, error: 'URL do Webhook não fornecida' };
        }

        try {
            // Resolve template variables recursively in body and url
            const resolveTemplate = (item: any): any => {
                if (typeof item === 'string') {
                    if (!item.includes('{{')) return item;
                    return item.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_: string, path: string) => {
                        const value = path.split('.').reduce((acc: any, part: string) => acc?.[part], context.variables);
                        return value !== undefined ? String(value) : `{{${path}}}`;
                    });
                }

                if (Array.isArray(item)) {
                    return item.map(resolveTemplate);
                }

                if (typeof item === 'object' && item !== null) {
                    const resolvedObj: any = {};
                    for (const [key, value] of Object.entries(item)) {
                        resolvedObj[key] = resolveTemplate(value);
                    }
                    return resolvedObj;
                }

                return item;
            };

            const resolvedUrl = resolveTemplate(url);
            const resolvedBody = resolveTemplate(body);
            const resolvedHeaders = resolveTemplate(headers);

            if (isSsrfBlockedUrl(resolvedUrl)) {
                return { success: false, error: `URL bloqueada por política de segurança: ${resolvedUrl}` };
            }

            const response = await axios({
                method: method.toUpperCase(),
                url: resolvedUrl,
                data: resolvedBody,
                headers: resolvedHeaders,
                timeout: 10000 // 10 seconds timeout
            });

            return {
                success: true,
                data: {
                    status: response.status,
                    data: response.data
                }
            };
        } catch (error) {
            this.logger.error(`Webhook Action Error: ${error.message}`);

            // Add useful debugging info without failing completely or crashing
            const errorDetails = error.response ? {
                status: error.response.status,
                data: error.response.data
            } : error.message;

            return {
                success: false,
                error: `Falha na requisição HTTP: ${error.message}`,
                data: errorDetails
            };
        }
    }
}
