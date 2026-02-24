#!/bin/sh
set -e

CERT_DIR=/etc/nginx/certs
DOMAIN=${DOMAIN:-localhost}

if [ ! -f "$CERT_DIR/key.pem" ]; then
    echo "[nginx] Certificados não encontrados em $CERT_DIR. Gerando auto-assinados para $DOMAIN..."
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$CERT_DIR/key.pem" \
        -out "$CERT_DIR/cert.pem" \
        -subj "/C=BR/ST=SP/L=SaoPaulo/O=KSZap/CN=$DOMAIN"
    echo "[nginx] Certificados gerados com sucesso."
else
    echo "[nginx] Certificados encontrados em $CERT_DIR. Pulando geração."
fi

echo "[nginx] Iniciando Nginx..."
exec "$@"
