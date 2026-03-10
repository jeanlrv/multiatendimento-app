namespace KBAgent;

/// <summary>
/// Gerencia FileSystemWatcher (detecção automática) + scheduler opcional.
/// Thread-safe via CancellationTokenSource por arquivo (debounce).
/// </summary>
public class SyncService : IDisposable
{
    private AgentConfig _config;
    private FileSystemWatcher? _watcher;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(5) };

    // Debounce: CancellationTokenSource por caminho de arquivo
    private readonly Dictionary<string, CancellationTokenSource> _debounce = new();
    private readonly object _debounceLock = new();

    // Scheduler
    private CancellationTokenSource? _schedulerCts;
    private Task? _schedulerTask;

    public event Action<string>? OnLog;

    public SyncService(AgentConfig config) => _config = config;

    public void UpdateConfig(AgentConfig config)
    {
        _config = config;
        Stop();
        if (config.IsConfigured) Start();
    }

    public void Start()
    {
        if (!_config.IsConfigured) return;
        StartWatcher();
        StartScheduler();

        if (_config.UploadOnStartup)
            Task.Run(() => UploadAllExistingFiles());
    }

    public void Stop()
    {
        _watcher?.Dispose();
        _watcher = null;
        _schedulerCts?.Cancel();
        _schedulerTask = null;
    }

    // ── FileSystemWatcher ────────────────────────────────────────────────────

    private void StartWatcher()
    {
        if (!Directory.Exists(_config.WatchFolder)) return;

        _watcher = new FileSystemWatcher(_config.WatchFolder)
        {
            EnableRaisingEvents = true,
            IncludeSubdirectories = true,
        };

        // Aplica filtros por extensão. FileSystemWatcher só aceita 1 filtro,
        // então usamos NotifyFilter e filtramos manualmente no handler.
        _watcher.NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size;
        _watcher.Created += OnFileEvent;
        _watcher.Changed += OnFileEvent;

        Log($"👁 Monitorando: {_config.WatchFolder}");
    }

    private void OnFileEvent(object sender, FileSystemEventArgs e)
    {
        if (!MatchesPattern(e.FullPath)) return;
        if (Directory.Exists(e.FullPath)) return; // ignora pastas

        TriggerDebounced(e.FullPath);
    }

    private void TriggerDebounced(string filePath)
    {
        CancellationTokenSource cts;
        lock (_debounceLock)
        {
            if (_debounce.TryGetValue(filePath, out var existing))
                existing.Cancel();

            cts = new CancellationTokenSource();
            _debounce[filePath] = cts;
        }

        var token = cts.Token;
        Task.Delay(_config.DebounceMs, token).ContinueWith(t =>
        {
            if (t.IsCanceled) return;
            lock (_debounceLock) _debounce.Remove(filePath);
            _ = UploadWithRetryAsync(filePath);
        }, TaskContinuationOptions.OnlyOnRanToCompletion);
    }

    // ── Scheduler ────────────────────────────────────────────────────────────

    private void StartScheduler()
    {
        var mode = _config.Schedule.Mode;
        if (mode == "onchange") return; // sem scheduler, só watcher

        _schedulerCts = new CancellationTokenSource();
        var token = _schedulerCts.Token;

        _schedulerTask = Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                await WaitForNextRun(token);
                if (!token.IsCancellationRequested)
                    await UploadAllExistingFiles();
            }
        }, token);
    }

    private async Task WaitForNextRun(CancellationToken token)
    {
        var mode = _config.Schedule.Mode;

        if (mode == "interval" || mode == "both")
        {
            await Task.Delay(TimeSpan.FromMinutes(_config.Schedule.IntervalMinutes), token);
            return;
        }

        if (mode == "daily")
        {
            var target = TimeOnly.Parse(_config.Schedule.DailyTime);
            var now = TimeOnly.FromDateTime(DateTime.Now);
            var delay = target > now
                ? target - now
                : TimeSpan.FromHours(24) - (now - target);
            await Task.Delay(delay, token);
        }
    }

    // ── Upload ───────────────────────────────────────────────────────────────

    /// <summary>Envia todos os arquivos da pasta que correspondem ao filtro.</summary>
    private async Task UploadAllExistingFiles()
    {
        if (!Directory.Exists(_config.WatchFolder)) return;

        var patterns = _config.FilePattern.Split(';', StringSplitOptions.RemoveEmptyEntries);
        var files = patterns
            .SelectMany(p => Directory.GetFiles(_config.WatchFolder, p, SearchOption.AllDirectories))
            .Distinct()
            .ToList();

        Log($"🔄 Varredura: {files.Count} arquivo(s) encontrado(s)");

        foreach (var file in files)
            await UploadWithRetryAsync(file);
    }

    public async Task UploadWithRetryAsync(string filePath)
    {
        if (!File.Exists(filePath)) return;
        var filename = Path.GetFileName(filePath);

        for (int attempt = 1; attempt <= _config.RetryAttempts; attempt++)
        {
            try
            {
                await using var stream = new FileStream(filePath,
                    FileMode.Open, FileAccess.Read, FileShare.ReadWrite);

                using var form = new MultipartFormDataContent();
                var content = new StreamContent(stream);
                content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
                form.Add(content, "file", filename);

                _http.DefaultRequestHeaders.Remove("x-agent-hostname");
                _http.DefaultRequestHeaders.Add("x-agent-hostname", Environment.MachineName);

                var resp = await _http.PostAsync(_config.UploadUrl, form);
                resp.EnsureSuccessStatusCode();

                Log($"✅ Enviado: {filename}");
                return;
            }
            catch (Exception ex)
            {
                Log($"⚠ Tentativa {attempt}/{_config.RetryAttempts} falhou — {filename}: {ex.Message}");
                if (attempt < _config.RetryAttempts)
                    await Task.Delay(TimeSpan.FromSeconds(_config.RetryDelaySeconds));
            }
        }

        Log($"❌ Falha definitiva: {filename}");
    }

    /// <summary>Testa a conexão enviando um payload mínimo.</summary>
    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            using var form = new MultipartFormDataContent();
            var content = new ByteArrayContent(new byte[] { 0 });
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
            form.Add(content, "file", "_test_connection_.bin");

            _http.DefaultRequestHeaders.Remove("x-agent-hostname");
            _http.DefaultRequestHeaders.Add("x-agent-hostname", Environment.MachineName);

            var resp = await _http.PostAsync(_config.UploadUrl, form);
            // 200/201 = OK, 401 = key inválida (conexão chegou)
            return resp.IsSuccessStatusCode || resp.StatusCode == System.Net.HttpStatusCode.Unauthorized;
        }
        catch
        {
            return false;
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private bool MatchesPattern(string filePath)
    {
        var ext = Path.GetExtension(filePath).TrimStart('.').ToLowerInvariant();
        return _config.FilePattern
            .Split(';', StringSplitOptions.RemoveEmptyEntries)
            .Any(p => p.TrimStart('*', '.').ToLowerInvariant() == ext);
    }

    public void Log(string message)
    {
        var line = $"[{DateTime.Now:HH:mm:ss}] {message}";
        OnLog?.Invoke(line);
    }

    public void Dispose()
    {
        Stop();
        _http.Dispose();
    }
}
