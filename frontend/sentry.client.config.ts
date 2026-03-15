import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
        replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 0.5 : 0,
        // Não capturar dados pessoais (LGPD)
        beforeSend(event) {
            // Remove request body que pode conter dados de formulário
            if (event.request?.data) delete event.request.data;
            if (event.request?.cookies) delete event.request.cookies;
            if (event.request?.headers?.authorization) delete event.request.headers.authorization;
            return event;
        },
    });
}
