# Documentação de Funcionalidades e Possibilidades - KSZap

O **KSZap** é uma plataforma robusta de atendimento multi-canal, integrando inteligência artificial e automação para otimizar a comunicação entre empresas e clientes via WhatsApp. Abaixo, detalhamos as funcionalidades implementadas e suas possibilidades de utilização.

---

## 📊 1. Dashboard e Monitoramento em Tempo Real
A central de comando para gestores e administradores.
- **Métricas de Atendimento:** Visualização de tickets abertos, em andamento, aguardando e resolvidos.
- **Análise de Sentimento Global:** Monitoramento do humor médio dos clientes em tempo real.
- **Status das Conexões:** Indicadores visuais do estado das instâncias de WhatsApp (Conectado, Desconectado, Erro).
- **Atividades Recentes:** Log em tempo real das interações no sistema.

---

## 💬 2. Gestão de Atendimento (Tickets e Chat)
Interface "Pixel Perfect" projetada para alta produtividade dos atendentes.
- **Chat Multimodal:** Suporte completo para envio e recebimento de:
  - Textos e Emojis.
  - Imagens, Vídeos e Documentos (PDF, etc).
  - Áudios (com player integrado de ondas sonoras).
- **Ciclo de Vida do Ticket:** Fluxo estruturado de `ABERTO` → `EM PROGRESSO` → `RESOLVIDO`.
- **Organização por Filas:** Separação entre "Minha Fila" e "Aguardando Atribuição".
- **Sistema de Tags e Notas:** Categorização de tickets por cores e adição de notas internas para histórico.
- **Badges de Notificação:** Contador visual de mensagens não lidas por ticket.

---

## 🤖 3. IA Hub Nativo (LangChain)
O centro de inteligência do KSZap, operando de forma integrada e multimodal.

### 3.1 RAG Avançado com Embeddings Multi-Provider
Agentes de IA que respondem com base em documentos (PDF, DOCX, TXT) e URLs, com armazenamento híbrido (Local/S3).

**Providers de Embedding Suportados:**

| Provider | Abordagem | Custo | Uso Recomendado |
|----------|-----------|-------|-----------------|
| **Python Embed** (padrão) | Script Python com sentence-transformers | 🆓 Free | Railway, Docker self-hosted |
| **Native (ONNX)** | Worker isolado com @xenova/transformers | 🆓 Free | Ambientes WASM compatíveis |
| **OpenAI** | API text-embedding-3-small | 💰 Baixo |Produção com alta performance |
| **Ollama** | Embedding local via Ollama | 🆓 Free | Development/local |

**Fallback Automático:**
1. Provider configured in database
2. Fallback para provider alternativo se falhar
3. OpenAI (se API key configurada)
4. Documento salvo sem vetorização (apenas busca full-text)

**Exemplo de Configuração:**
```typescript
// No VectorStoreService
const embeddings = await this.generateEmbeddingBatch(
    chunkedTexts,
    'python-embed',  // ou 'native', 'openai', 'ollama'
    'paraphrase-MiniLM-L6-v2'
);
```

**Embedding via Python (backend/embedding.py):**
```python
# Script rodando no mesmo container Docker
python3 embedding.py "texto do chunk"
# Output: {"success": true, "embedding": [384 floats]}
```

### 3.2 Vision (Multimodal)
Análise e descrição de imagens enviadas no chat (GPT-4o/Gemini).

### 3.3 Transcrição de Áudio
Conversão automática de mensagens de voz recebidas em texto (Speech-to-Text).

### 3.4 Playground de IA
Ambiente de teste para agentes com histórico de conversas persistente.

### 3.5 Sentiment & Transcription
Análise de sentimento em tempo real e score automático por interação.

### 3.6 Copilot de Atendimento
Sugestões de respostas inteligentes baseadas no contexto da base de conhecimento.

---

## 📱 4. Conectividade WhatsApp (Z-API)

---

## 🏢 5. Estrutura Organizacional e Departamentos
Segmentação lógica do atendimento empresarial.
- **Criação de Setores:** Divisão por Suporte, Vendas, Financeiro, etc.
- **Horário de Funcionamento:** Definição de jornadas (ex: 08h às 18h) com mensagens de ausência automáticas.
- **SLA e Distribuição:** Configuração de tempos de resposta e distribuição automática de tickets entre agentes do departamento.
- **Vínculo de Agentes de IA:** Cada departamento pode ter um "Agente de IA" específico treinado para suas funções.

---

## ⚙️ 6. Workflows e Automação de Fluxos
Regras de negócio que automatizam ações repetitivas ou críticas.
- **Gatilhos por Eventos:** Disparos automáticos baseados em mudança de status ou análise de sentimento.
- **Ações Automatizadas:**
  - **Escalonamento Prioritário:** Aumentar prioridade de tickets com sentimento negativo.
  - **Alertas de Supervisão:** Envio de e-mails ou notificações para gestores em casos críticos.
  - **Execuções Históricas:** Painel para auditoria de quais automações foram disparadas e seus resultados.

---

## 📑 7. CRM Lite e Gestão de Contatos
Base unificada de clientes.
- **Histórico de Interações:** Todo o log de tickets e mensagens vinculado ao contato.
- **Enriquecimento de Perfil:** Nome, e-mail, notas e foto de perfil sincronizados do WhatsApp.
- **Busca Global:** Encontre contatos e conversas rapidamente por nome ou número.

---

## 🔒 8. Segurança e Auditoria
Controle total sobre quem acessa o quê e o que foi feito.
- **RBAC (Controle de Acesso):** Perfis de `Administrador`, `Gestor` e `Atendente` com permissões granulares.
- **Logs de Auditoria:** Registro detalhado de ações (quem criou, alterou ou deletou informações).
- **Autenticação JWT:** Sessões seguras com sistema de Refresh Token.

---

> [!TIP]
> **Possibilidade de Futuro:** O sistema está preparado para integração com outros canais (Instagram, Messenger) devido à sua arquitetura modular.
