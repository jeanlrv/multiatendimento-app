# Guia de Integração Z-API - KSZap

Este guia detalha como configurar a integração entre a plataforma **Z-API** e o **KSZap** para habilitar o envio de mensagens, recebimento via webhooks, indicadores de digitação e confirmações de leitura.

## 1. Configuração na Plataforma Z-API

Para que o KSZap funcione corretamente, você deve configurar sua instância na Z-API:

1.  **Acesse o painel da Z-API**: [https://painel.z-api.io/](https://painel.z-api.io/)
2.  **Crie ou selecione uma Instância**.
3.  **Obtenha suas Credenciais**:
    *   **ID da Instância**: Localizado no topo do painel.
    *   **Token**: Localizado na aba "Segurança" ou "Configurações".
4.  **Configurar Webhooks**:
    *   Vá até a seção **Webhooks** da sua instância.
    *   Aponte a URL de recebimento para: `https://seu-dominio.com/api/webhooks/zapi`
    *   **Eventos Recomendados**: 
        *   Mensagem Recebida (`message.received`)
        *   Status da Mensagem (`message.status`)
        *   Presença no Chat (`chat.presence`)
        *   Instância Conectada (`connected`)
        *   Instância Desconectada (`disconnected`)

## 2. Configuração no KSZap (Modelo SaaS-First)

O KSZap agora utiliza uma arquitetura centralizada. Siga estes passos:

### Passo A: Configurar Chaves Globais (Administrador)
1.  Acesse **Configurações > Integrações**.
2.  Clique em **Integrar Novo Provedor Tático**.
3.  Insira o **ID da Instância** e o **Token** obtidos na Z-API.
4.  Salve as configurações. Estas chaves agora servirão para todos os canais da sua empresa.

### Passo B: Criar Canal de Atendimento (Usuário/Admin)
1.  Vá para **Canais > Conexões**.
2.  Clique em **Novo Canal**.
3.  Insira apenas o **Nome** (ex: Comercial) e selecione os **Setores (Departamentos)**.
4.  Clique em **Consolidar Canal**.
5.  Clique em **SYNC QR**, escaneie com seu WhatsApp e pronto!

## 3. Benefícios da Nova Arquitetura

*   **Segurança Máxima**: Chaves API ficam em área restrita de configurações, longe do fluxo operacional.
*   **Escalabilidade**: Adicione múltiplos números de WhatsApp usando as mesmas credenciais globais da empresa.
*   **Simplicidade**: O usuário final não precisa mais lidar com Tokens ou IDs técnicos para conectar um novo telefone.
*   **Multi-tenancy Real**: O sistema identifica automaticamente para qual empresa a mensagem pertence via `instanceId` dinâmico.

---
> [!IMPORTANT]
> Certifique-se de que a URL do Webhook na Z-API esteja correta para que o status das mensagens e o recebimento funcionem em tempo real.
