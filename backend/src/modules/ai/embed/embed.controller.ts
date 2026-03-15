import { Controller, Get, Post, Body, Param, Headers, Req, Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SkipThrottle } from '@nestjs/throttler';
import { EmbedService } from './embed.service';
import { Response, Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator';

@SkipThrottle()
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
    @Post(':embedId/chat-stream')
    async streamChat(
        @Param('embedId') embedId: string,
        @Body() body: { sessionId: string; message: string },
        @Headers('origin') origin: string,
        @Res() res: Response,
    ): Promise<void> {
        const r = res as any;
        r.setHeader('Content-Type', 'text/event-stream');
        r.setHeader('Cache-Control', 'no-cache, no-transform');
        r.setHeader('Connection', 'keep-alive');
        r.setHeader('X-Accel-Buffering', 'no');
        r.flushHeaders();

        try {
            const observable = await this.embedService.streamChat(embedId, body.sessionId, body.message, origin);
            observable.subscribe({
                next: (event: any) => r.write(`data: ${JSON.stringify(event.data)}\n\n`),
                error: (err: any) => {
                    r.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
                    r.end();
                },
                complete: () => r.end(),
            });
        } catch (err: any) {
            r.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
            r.end();
        }
    }

    @Public()
    @Post(':embedId/chat-with-attachment')
    @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
        fileFilter: (_req, file, cb) => {
            const allowed = [
                'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                'application/pdf', 'text/plain', 'text/csv',
            ];
            if (allowed.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}. Use imagens, PDF ou texto.`), false);
            }
        },
    }))
    async chatWithAttachment(
        @Param('embedId') embedId: string,
        @Body('message') message: string,
        @Body('sessionId') sessionId: string,
        @UploadedFile() file: Express.Multer.File,
        @Headers('origin') origin: string,
    ) {
        if (!file) throw new BadRequestException('Arquivo obrigatório.');
        return this.embedService.chatWithAttachment(embedId, sessionId, message ?? '', file, origin);
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
            return res.status(404).send('console.error("[KSZap] Widget não encontrado ou desativado. Verifique se o agente está ativo, o widget está habilitado e o agente foi salvo.");');
        }

        // Prioridade para resolver a URL pública do frontend:
        // 1. ?frontend= query param (gerado pelo WidgetConfigTab via window.location.origin — mais confiável)
        // 2. FRONTEND_PUBLIC_URL env var (configurado manualmente no Railway)
        // 3. CORS_ORIGIN env var (fallback — pode ser URL interna no Railway!)
        const frontendParam = req.query?.frontend as string | undefined;
        const frontendUrl = (frontendParam && frontendParam.startsWith('http'))
            ? frontendParam
            : (process.env.FRONTEND_PUBLIC_URL || process.env.CORS_ORIGIN);

        if (!frontendUrl) {
            return res.status(500).send('console.error("[KSZap] URL do frontend não resolvida. Configure FRONTEND_PUBLIC_URL no servidor ou regenere o script de embed no painel.");');
        }

        const positionProp = config.position === 'bottom-left' ? 'left: 20px;' : 'right: 20px;';

        // URL pública do backend para chamadas API dentro do iframe
        // Prioridade: BACKEND_PUBLIC_URL env > protocolo+host da requisição atual
        const backendPublicUrl = (
            process.env.BACKEND_PUBLIC_URL ||
            `${req.protocol}://${req.get('host')}`
        ).replace(/\/+$/, '');

        // Escape values safe for JS string injection
        const safeName = (config.agentName || 'Chat').replace(/['"\\]/g, '');
        const safeColor = (config.brandColor || '#4F46E5').replace(/['"\\]/g, '');
        const safeLogo = (config.brandLogo || '').replace(/['"\\]/g, '');
        const safeApiUrl = backendPublicUrl.replace(/['"\\]/g, '');

        const scriptContent = `
(function() {
    if (document.getElementById('kszap-embed-container')) return;

    var embedId   = "${embedId}";
    var brandColor = "${safeColor}";
    var brandLogo  = "${safeLogo}";
    var agentName  = "${safeName}";
    var frontendUrl = "${frontendUrl}";
    var apiUrl     = "${safeApiUrl}";
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
    iframe.src = frontendUrl + '/embed/' + embedId + '?api=' + encodeURIComponent(apiUrl);
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

    // ── Legacy embed (IE7+) ────────────────────────────────────────────────

    @Public()
    @Get(':embedId/script-legacy.js')
    async getLegacyScript(
        @Param('embedId') embedId: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const origin = req.headers.origin;
        const config = await this.embedService.getPublicConfig(embedId, origin as string).catch(() => null);

        if (!config) {
            return res.status(404).send('console.error("[KSZap] Widget n\\u00e3o encontrado ou desativado.");');
        }

        const backendPublicUrl = (
            process.env.BACKEND_PUBLIC_URL ||
            `${req.protocol}://${req.get('host')}`
        ).replace(/\/+$/, '');

        const safeName  = (config.agentName || 'Chat').replace(/['\"\\<>]/g, '');
        const safeColor = (config.brandColor || '#4F46E5').replace(/['\"\\<>]/g, '');
        const positionProp = config.position === 'bottom-left' ? 'left:20px;' : 'right:20px;';
        // Passa backendUrl como query param para que legacy-chat saiba a URL pública correta
        const chatUrl = `${backendPublicUrl}/api/embed/${embedId}/legacy-chat?backendUrl=${encodeURIComponent(backendPublicUrl)}`;

        const scriptContent = `(function() {
    if (document.getElementById('kszap-legacy-btn')) return;
    var agentName  = "${safeName}";
    var brandColor = "${safeColor}";
    var chatUrl    = "${chatUrl}";
    var posStyle   = "${positionProp}";
    var popupRef   = null;

    var btn = document.createElement('button');
    btn.id = 'kszap-legacy-btn';
    btn.style.cssText = 'position:fixed;bottom:20px;' + posStyle +
        'z-index:999999;padding:12px 20px;background:' + brandColor +
        ';color:#fff;border:0;cursor:pointer;font-size:14px;' +
        'font-family:Arial,sans-serif;border-radius:4px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,0.25);';
    btn.innerHTML = agentName;

    btn.onclick = function() {
        if (popupRef && !popupRef.closed) {
            popupRef.focus();
        } else {
            popupRef = window.open(chatUrl, 'kszap_chat',
                'width=420,height=600,resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no');
        }
        return false;
    };

    function attach() { document.body.appendChild(btn); }
    if (document.body) {
        attach();
    } else if (window.attachEvent) {
        window.attachEvent('onload', attach);
    } else {
        window.addEventListener('load', attach, false);
    }
})();`;

        res.set('Content-Type', 'application/javascript; charset=utf-8');
        res.set('Cache-Control', 'no-cache, no-store');
        res.set('Access-Control-Allow-Origin', '*');
        return res.send(scriptContent);
    }

    @Public()
    @Get(':embedId/legacy-chat')
    async getLegacyChat(
        @Param('embedId') embedId: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const origin = req.headers.origin;
        const config = await this.embedService.getPublicConfig(embedId, origin as string).catch(() => null);

        if (!config) {
            return res.status(404).type('html').send('<html><body style="font-family:Arial;padding:20px"><p>Chat indispon&#237;vel ou desativado.</p></body></html>');
        }

        // Prioridade: ?backendUrl param (passado pelo iframe/script) > env var > req.host (pode ser URL interna via proxy)
        // Usa new URL() para extrair só a origin limpa (evita %22 ou outros caracteres inválidos no hostname)
        const extractOrigin = (raw: string): string => {
            try { return new URL(raw).origin; } catch { return ''; }
        };
        const queryBackendUrl = (req.query as any)?.backendUrl as string;
        const backendPublicUrl = (
            (queryBackendUrl?.startsWith('http') ? extractOrigin(queryBackendUrl) : '') ||
            (process.env.BACKEND_PUBLIC_URL ? extractOrigin(process.env.BACKEND_PUBLIC_URL) : '') ||
            `${req.protocol}://${req.get('host')}`
        );

        const escJs   = (s: string) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/</g, '\\x3C');
        const escHtml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const escColor = (s: string) => (s || '#4F46E5').replace(/[^#a-zA-Z0-9]/g, '');

        const color           = escColor(config.brandColor || '#4F46E5');
        const nameHtml        = escHtml(config.agentName || 'Chat');
        const welcomeJs       = escJs(config.welcomeMsg || '');
        const placeholderHtml = escHtml(config.placeholder || 'Digite sua mensagem...');
        const apiJs           = escJs(backendPublicUrl);
        const embedIdJs       = escJs(embedId);

        const html = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html><head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${nameHtml} - Chat</title>
<style type="text/css">
* { margin:0; padding:0; }
html, body { width:100%; height:100%; font-family:Arial,Helvetica,sans-serif; background:#f5f5f5; }
#hdr { background:${color}; color:#fff; padding:10px 14px; font-size:15px; font-weight:bold; height:44px; overflow:hidden; }
#msgs { height:440px; overflow-y:auto; padding:8px 10px; background:#fff; border-bottom:1px solid #ddd; }
#sbar { height:22px; padding:2px 8px; font-size:11px; color:#999; text-align:center; background:#fafafa; }
#iarea { padding:8px; background:#f7f7f7; border-top:1px solid #ccc; }
#itbl { width:100%; border-collapse:collapse; }
#uinput { width:100%; padding:6px 8px; border:1px solid #ccc; font-size:13px; font-family:Arial,Helvetica,sans-serif; }
#sbtn { padding:6px 14px; background:${color}; color:#fff; border:0; font-size:13px; font-family:Arial,Helvetica,sans-serif; cursor:pointer; white-space:nowrap; }
.mw { margin:4px 0; overflow:hidden; }
.mu { text-align:right; } .mb { text-align:left; }
.mb span { display:inline-block; padding:7px 12px; font-size:13px; line-height:1.4; max-width:80%; word-wrap:break-word; background:#e8e8e8; color:#333; }
.mu span { display:inline-block; padding:7px 12px; font-size:13px; line-height:1.4; max-width:80%; word-wrap:break-word; background:${color}; color:#fff; }
</style>
</head><body>
<div id="hdr">${nameHtml}</div>
<div id="msgs"></div>
<div id="sbar">&nbsp;</div>
<div id="iarea">
  <table id="itbl"><tr>
    <td style="width:100%;padding-right:6px;"><input type="text" id="uinput" placeholder="${placeholderHtml}"></td>
    <td><button type="button" id="sbtn">Enviar</button></td>
  </tr></table>
</div>
<script type="text/javascript">
var EID = "${embedIdJs}";
var API = "${apiJs}";
var WEL = "${welcomeJs}";
var SID = '';
var BSY = false;

function el(id) { return document.getElementById(id); }

function esc(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addMsg(role, text) {
    var d = document.createElement('div');
    d.className = 'mw m' + role.charAt(0);
    var s = document.createElement('span');
    s.innerHTML = esc(text).replace(/\\n/g,'<br>');
    d.appendChild(s);
    el('msgs').appendChild(d);
    el('msgs').scrollTop = 99999;
}

function setS(t) { el('sbar').innerHTML = t || '&nbsp;'; }

function mkXHR() {
    if (window.XMLHttpRequest) return new XMLHttpRequest();
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    return null;
}

function jp(s) {
    try { return JSON.parse(s); } catch(e) { return null; }
}

function uid() {
    var t = (new Date()).getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (t + Math.random() * 16) % 16 | 0;
        t = Math.floor(t / 16);
        return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
}

function gc(n) {
    var a = document.cookie.split(';'), i, k, p;
    for (i = 0; i < a.length; i++) {
        k = a[i];
        while (k.length && k.charAt(0) === ' ') k = k.substring(1);
        p = k.split('=');
        if (p[0] === n) return decodeURIComponent(p[1] || '');
    }
    return '';
}

function sc(n, v) {
    var e = new Date();
    e.setDate(e.getDate() + 30);
    document.cookie = n + '=' + encodeURIComponent(v) + '; expires=' + e.toUTCString() + '; path=/';
}

function trimStr(s) {
    while (s.length && s.charAt(0) === ' ') s = s.substring(1);
    while (s.length && s.charAt(s.length - 1) === ' ') s = s.substring(0, s.length - 1);
    return s;
}

function escMsg(m) {
    var bs = String.fromCharCode(92);
    var dq = String.fromCharCode(34);
    var nl = String.fromCharCode(10);
    var r = '', i, c;
    for (i = 0; i < m.length; i++) {
        c = m.charAt(i);
        if (c === dq) { r += bs + dq; }
        else if (c === bs) { r += bs + bs; }
        else if (c === nl) { r += bs + 'n'; }
        else if (m.charCodeAt(i) !== 13) { r += c; }
    }
    return r;
}

function send() {
    if (BSY) return;
    var inp = el('uinput'), msg = inp.value;
    if (!trimStr(msg)) return;
    inp.value = '';
    BSY = true;
    setS('Aguardando resposta...');
    addMsg('u', msg);
    var x = mkXHR();
    if (!x) { addMsg('b', 'Navegador sem suporte a requisicoes HTTP.'); BSY = false; setS(''); return; }
    x.open('POST', API + '/api/embed/' + EID + '/chat', true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function() {
        if (x.readyState === 4) {
            BSY = false; setS('');
            if (x.status === 200) {
                try { addMsg('b', jp(x.responseText).response || ''); }
                catch(e) { addMsg('b', 'Erro na resposta do servidor.'); }
            } else if (x.status === 429) {
                addMsg('b', 'Limite de mensagens atingido. Tente mais tarde.');
            } else {
                var errMsg = 'Erro ao enviar. Tente novamente.';
                try { var ed = jp(x.responseText); if (ed && ed.message) errMsg = ed.message; } catch(e2) {}
                addMsg('b', errMsg);
            }
        }
    };
    x.send('{"sessionId":"' + SID + '","message":"' + escMsg(msg) + '"}');
}

window.onload = function() {
    SID = gc('kszap_s_' + EID);
    if (!SID) { SID = uid(); sc('kszap_s_' + EID, SID); }
    if (WEL) addMsg('b', WEL);
    el('sbtn').onclick = function() { send(); return false; };
    el('uinput').onkeydown = function(e) {
        var ev = e || window.event;
        if (ev.keyCode === 13) { send(); return false; }
    };
};
</script>
</body></html>`;

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'no-cache, no-store');
        // Permitir framing de qualquer origem — incluindo file:// (null origin) para testes locais.
        // Helmet adiciona frame-ancestors 'self'; removemos o header inteiro para que o browser
        // não tenha restrições de frame-ancestors. X-Frame-Options: ALLOWALL (valor inválido,
        // ignorado por todos os browsers modernos = framing liberado). IE aceita ALLOWALL nativamente.
        (res as any).removeHeader('Content-Security-Policy');
        res.set('X-Frame-Options', 'ALLOWALL');
        return res.send(html);
    }
}
