FROM nginx:alpine

# Instalar openssl para geração de cert self-signed em desenvolvimento
RUN apk add --no-cache openssl curl

# Remove configuração padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copia configuração customizada
COPY nginx.conf /etc/nginx/conf.d/
RUN sed -i 's/\r$//' /etc/nginx/conf.d/nginx.conf

# Copia entrypoint que gera cert self-signed se necessário
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
