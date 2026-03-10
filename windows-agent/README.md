# KBAgent — Agente Windows para Upload Automático

Monitora pasta(s) e envia arquivos automaticamente para a base de conhecimento da plataforma.

## Compilar

```powershell
dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true
# Executável em: bin\Release\net8.0-windows\win-x64\publish\KBAgent.exe
```

## Instalar como Serviço do Windows (opcional)

```powershell
# Como Administrador:
sc create KBAgent binpath="C:\caminho\para\KBAgent.exe" start=auto
sc start KBAgent

# Remover:
sc stop KBAgent
sc delete KBAgent
```

## Uso via Tray Icon

1. Execute `KBAgent.exe`
2. Aparece no tray (bandeja do sistema)
3. Clique duplo → Configurações
4. Preencha:
   - **URL Base do Webhook**: `https://seu-backend/api/ai/knowledge/webhook`
   - **API Key**: copiada da página da base de conhecimento
   - **Pasta monitorada**: pasta onde o ERP salva os relatórios
5. Salve → o agente começa a monitorar automaticamente

## Comportamento

- **Detecção automática**: qualquer arquivo novo ou modificado na pasta é enviado em ~2s
- **Substituição por nome**: se já existe um documento com o mesmo nome na KB, é substituído
- **Retry**: 3 tentativas com delay de 30s em caso de falha
- **Log**: clique em "Ver Log..." no menu do tray

## Configuração (`appsettings.json`)

```json
{
  "KBAgent": {
    "WebhookUrl": "https://backend/api/ai/knowledge/webhook",
    "ApiKey": "kwh_...",
    "WatchFolder": "C:\\ERP\\relatorios",
    "FilePattern": "*.pdf;*.xlsx;*.csv;*.txt",
    "DebounceMs": 2000,
    "RetryAttempts": 3,
    "RetryDelaySeconds": 30,
    "UploadOnStartup": true,
    "Schedule": {
      "Mode": "onchange",
      "IntervalMinutes": 60,
      "DailyTime": "18:00"
    },
    "StartWithWindows": false
  }
}
```

### Modos de Agendamento (`Schedule.Mode`)

| Modo | Comportamento |
|------|---------------|
| `onchange` | Somente ao detectar mudança (padrão) |
| `interval` | A cada N minutos (+ detecção) |
| `daily` | Todo dia no horário configurado (+ detecção) |
| `both` | Intervalo + detecção |
