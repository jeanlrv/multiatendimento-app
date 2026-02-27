import { Controller, Get, Post, Body, Param, Headers, Req, Res } from '@nestjs/common';
import { EmbedService } from './embed.service';
import { Response, Request } from 'express';
// Assumindo que temos um decorador @Public ou similar se usar global AuthGuard
import { Public } from '../../../common/decorators/public.decorator';

@Controller('embed')
export class EmbedController {
    constructor(private readonly embedService: EmbedService) { }

    @Public()
    @Get(':embedId')
    async getPublicConfig(
        @Param('embedId') embedId: string,
        @Headers('origin') origin: string
    ) {
        return this.embedService.getPublicConfig(embedId, origin);
    }

    @Public()
    @Post(':embedId/chat')
    async chat(
        @Param('embedId') embedId: string,
        @Body() body: { sessionId: string; message: string },
        @Headers('origin') origin: string
    ) {
        return this.embedService.chat(embedId, body.sessionId, body.message, origin);
    }

    @Public()
    @Get(':embedId/history/:sessionId')
    async getHistory(
        @Param('embedId') embedId: string,
        @Param('sessionId') sessionId: string,
        @Headers('origin') origin: string
    ) {
        return this.embedService.getHistory(embedId, sessionId, origin);
    }

    @Public()
    @Get(':embedId/script.js')
    async getEmbedScript(
        @Param('embedId') embedId: string,
        @Req() req: Request,
        @Res() res: Response
    ) {
        const origin = req.headers.origin;
        // Valida se o agente existe para retornar o script
        const config = await this.embedService.getPublicConfig(embedId, origin as string).catch(() => null);

        if (!config) {
            return res.status(404).send('console.error("Agent not found or disabled.");');
        }

        // Tentar obter a URL do frontend da variável de ambiente, ou hardcodar para testes/fallback
        // Acesso via process.env.NEXT_PUBLIC_API_URL seria o endpoint, frontend URL pode ser outra env var
        // Assumindo que frontend e backend rodam com domínios conhecidos no ambiente
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        const positionObj = config.position === 'bottom-left'
            ? 'left: 20px;'
            : 'right: 20px;';

        const scriptContent = `
(function() {
    const embedId = "${embedId}";
    const brandColor = "${config.brandColor}";
    const frontendUrl = "${frontendUrl}";
    const positionStyle = "${positionObj}";

    // Container
    const container = document.createElement('div');
    container.id = 'kszap-embed-container';
    container.style.cssText = \`
        position: fixed;
        bottom: 20px;
        \${positionStyle}
        z-index: 999999;
        font-family: sans-serif;
    \`;

    // Iframe (hidden initially)
    const iframe = document.createElement('iframe');
    iframe.src = \`\${frontendUrl}/embed/\${embedId}\`;
    iframe.id = 'kszap-embed-iframe';
    iframe.style.cssText = \`
        display: none;
        width: 380px;
        height: 600px;
        max-height: 80vh;
        border: none;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        background: transparent;
        transition: all 0.3s ease;
        margin-bottom: 20px;
    \`;

    // Adjust size for mobile
    if (window.innerWidth < 400) {
       iframe.style.width = (window.innerWidth - 40) + 'px';
    }

    // Toggle Button
    const button = document.createElement('button');
    button.id = 'kszap-embed-button';
    button.style.cssText = \`
        width: 60px;
        height: 60px;
        border-radius: 30px;
        background-color: \${brandColor};
        color: white;
        border: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        padding: 0;
        margin-left: auto;
    \`;
    if (config.position === 'bottom-left') {
        button.style.marginLeft = '0';
        button.style.marginRight = 'auto';
    }

    const chatIcon = \`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>\`;
    const closeIcon = \`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>\`;
    
    button.innerHTML = chatIcon;

    let isOpen = false;

    button.onclick = function() {
        isOpen = !isOpen;
        if (isOpen) {
            iframe.style.display = 'block';
            button.innerHTML = closeIcon;
            button.style.transform = 'scale(0.9)';
            setTimeout(() => button.style.transform = 'scale(1)', 150);
        } else {
            iframe.style.display = 'none';
            button.innerHTML = chatIcon;
        }
    };

    container.appendChild(iframe);
    container.appendChild(button);
    document.body.appendChild(container);

    // Listen to messages from iframe if needed (e.g., closing from inside)
    window.addEventListener('message', function(event) {
        if (event.origin !== frontendUrl) return;
        if (event.data === 'KSZAP_CLOSE_EMBED') {
            isOpen = false;
            iframe.style.display = 'none';
            button.innerHTML = chatIcon;
        }
    });
})();
`;

        res.set('Content-Type', 'application/javascript');
        return res.send(scriptContent);
    }
}
