import { Controller, Get, Post, Body, Param, Headers, Req, Res } from '@nestjs/common';
import { EmbedService } from './embed.service';
import { Response, Request } from 'express';
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
        const config = await this.embedService.getPublicConfig(embedId, origin as string).catch(() => null);

        if (!config) {
            return res.status(404).send('console.error("[KSZap] Agent not found or disabled.");');
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const positionProp = config.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;';

        // Escape values safe for JS string injection
        const safeName = (config.agentName || 'Chat').replace(/['"\\]/g, '');
        const safeColor = (config.brandColor || '#4F46E5').replace(/['"\\]/g, '');
        const safeLogo = (config.brandLogo || '').replace(/['"\\]/g, '');

        const scriptContent = `
(function() {
    if (document.getElementById('kszap-embed-container')) return;

    var embedId   = "${embedId}";
    var brandColor = "${safeColor}";
    var brandLogo  = "${safeLogo}";
    var agentName  = "${safeName}";
    var frontendUrl = "${frontendUrl}";
    var positionStyle = "${positionProp}";
    var isOpen = false;

    /* ── Injetar CSS de animação ── */
    var style = document.createElement('style');
    style.textContent = [
        '#kszap-embed-iframe {',
        '  transition: opacity 0.28s ease, transform 0.28s ease;',
        '  opacity: 0;',
        '  transform: translateY(12px) scale(0.97);',
        '  pointer-events: none;',
        '}',
        '#kszap-embed-iframe.kszap-open {',
        '  opacity: 1;',
        '  transform: translateY(0) scale(1);',
        '  pointer-events: auto;',
        '}',
        '#kszap-embed-button {',
        '  transition: transform 0.2s ease, box-shadow 0.2s ease;',
        '}',
        '#kszap-embed-button:hover {',
        '  transform: scale(1.08);',
        '  box-shadow: 0 6px 20px rgba(0,0,0,0.22) !important;',
        '}',
        '#kszap-embed-button:active { transform: scale(0.95); }',
    ].join('\\n');
    document.head.appendChild(style);

    /* ── Container fixo ── */
    var container = document.createElement('div');
    container.id = 'kszap-embed-container';
    container.style.cssText = [
        'position: fixed;',
        'bottom: 20px;',
        positionStyle,
        'z-index: 999999;',
        'display: flex;',
        'flex-direction: column;',
        'align-items: ' + (positionStyle.indexOf('left') !== -1 ? 'flex-start' : 'flex-end') + ';',
    ].join('');

    /* ── Iframe ── */
    var iframe = document.createElement('iframe');
    iframe.src = frontendUrl + '/embed/' + embedId;
    iframe.id = 'kszap-embed-iframe';
    iframe.allow = 'microphone';
    iframe.style.cssText = [
        'width: 380px;',
        'height: 600px;',
        'max-height: 80vh;',
        'max-width: calc(100vw - 40px);',
        'border: none;',
        'border-radius: 16px;',
        'box-shadow: 0 12px 48px rgba(0,0,0,0.18);',
        'background: white;',
        'margin-bottom: 16px;',
        'display: block;',
    ].join('');

    /* ── Botão toggle ── */
    var button = document.createElement('button');
    button.id = 'kszap-embed-button';
    button.setAttribute('aria-label', 'Abrir chat ' + agentName);
    button.style.cssText = [
        'width: 60px;',
        'height: 60px;',
        'border-radius: 30px;',
        'background-color: ' + brandColor + ';',
        'color: white;',
        'border: none;',
        'box-shadow: 0 4px 16px rgba(0,0,0,0.2);',
        'cursor: pointer;',
        'display: flex;',
        'align-items: center;',
        'justify-content: center;',
        'padding: 0;',
        'overflow: hidden;',
    ].join('');

    var chatIcon = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    var closeIcon = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    /* Usa avatar do agente no botão quando disponível */
    if (brandLogo) {
        var avatarImg = document.createElement('img');
        avatarImg.src = brandLogo;
        avatarImg.alt = agentName;
        avatarImg.style.cssText = 'width: 60px; height: 60px; border-radius: 50%; object-fit: cover; display: block;';
        avatarImg.onerror = function() { button.innerHTML = chatIcon; };
        button.appendChild(avatarImg);
    } else {
        button.innerHTML = chatIcon;
    }

    function openWidget() {
        isOpen = true;
        iframe.classList.add('kszap-open');
        button.innerHTML = closeIcon;
        button.style.backgroundColor = brandColor;
        button.setAttribute('aria-label', 'Fechar chat');
    }

    function closeWidget() {
        isOpen = false;
        iframe.classList.remove('kszap-open');
        button.setAttribute('aria-label', 'Abrir chat ' + agentName);
        /* Restaura avatar ou ícone */
        if (brandLogo) {
            var img = document.createElement('img');
            img.src = brandLogo;
            img.alt = agentName;
            img.style.cssText = 'width: 60px; height: 60px; border-radius: 50%; object-fit: cover; display: block;';
            img.onerror = function() { button.innerHTML = chatIcon; };
            button.innerHTML = '';
            button.appendChild(img);
        } else {
            button.innerHTML = chatIcon;
        }
    }

    button.onclick = function() {
        if (isOpen) { closeWidget(); } else { openWidget(); }
    };

    container.appendChild(iframe);
    container.appendChild(button);
    document.body.appendChild(container);

    /* Escuta mensagem de fechar vinda de dentro do iframe */
    window.addEventListener('message', function(event) {
        if (event.origin !== frontendUrl) return;
        if (event.data === 'KSZAP_CLOSE_EMBED') closeWidget();
    });
})();
`;

        res.set('Content-Type', 'application/javascript; charset=utf-8');
        res.set('Cache-Control', 'no-cache, no-store');
        return res.send(scriptContent);
    }
}
