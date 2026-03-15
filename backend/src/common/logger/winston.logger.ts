import { LoggerService, LogLevel } from '@nestjs/common';
import * as winston from 'winston';
import { join } from 'path';

const isDev = process.env.NODE_ENV !== 'production';

const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const ctx = context ? `[${context}] ` : '';
        const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level} ${ctx}${message}${extra}`;
    }),
);

const transports: winston.transport[] = [
    new winston.transports.Console({
        format: isDev ? consoleFormat : jsonFormat,
    }),
];

// Em produção adiciona arquivo de log rotacionado por dia
if (!isDev) {
    transports.push(
        new winston.transports.File({
            filename: join(process.cwd(), 'logs', 'app.log'),
            format: jsonFormat,
            maxsize: 20 * 1024 * 1024, // 20 MB por arquivo
            maxFiles: 7,
            tailable: true,
        }),
        new winston.transports.File({
            filename: join(process.cwd(), 'logs', 'error.log'),
            level: 'error',
            format: jsonFormat,
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7,
        }),
    );
}

const winstonInstance = winston.createLogger({
    level: isDev ? 'debug' : 'info',
    transports,
});

export class WinstonLogger implements LoggerService {
    private context?: string;

    constructor(context?: string) {
        this.context = context;
    }

    log(message: any, context?: string) {
        winstonInstance.info(this.formatMessage(message), { context: context || this.context });
    }

    error(message: any, trace?: string, context?: string) {
        winstonInstance.error(this.formatMessage(message), {
            context: context || this.context,
            ...(trace && { stack: trace }),
        });
    }

    warn(message: any, context?: string) {
        winstonInstance.warn(this.formatMessage(message), { context: context || this.context });
    }

    debug(message: any, context?: string) {
        winstonInstance.debug(this.formatMessage(message), { context: context || this.context });
    }

    verbose(message: any, context?: string) {
        winstonInstance.verbose(this.formatMessage(message), { context: context || this.context });
    }

    setLogLevels(_levels: LogLevel[]) {
        // NestJS interface requirement — Winston manages levels internally
    }

    private formatMessage(message: any): string {
        if (typeof message === 'string') return message;
        if (message instanceof Error) return message.message;
        try { return JSON.stringify(message); } catch { return String(message); }
    }
}
