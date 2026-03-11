namespace KBAgent;

public class AgentConfig
{
    /// <summary>
    /// URL completa de upload — copie diretamente do painel da Base de Conhecimento.
    /// Formato: https://seu-backend.com/api/ai/knowledge/webhook/kwh_.../upload
    /// </summary>
    public string UploadUrl { get; set; } = "";
    public string WatchFolder { get; set; } = "";
    public string FilePattern { get; set; } = "*.pdf;*.xlsx;*.xls;*.csv;*.txt;*.docx;*.json;*.xml";
    public int DebounceMs { get; set; } = 2000;
    public int RetryAttempts { get; set; } = 3;
    public int RetryDelaySeconds { get; set; } = 30;
    public bool UploadOnStartup { get; set; } = true;
    public ScheduleConfig Schedule { get; set; } = new();
    public bool StartWithWindows { get; set; } = false;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(UploadUrl) &&
                                !string.IsNullOrWhiteSpace(WatchFolder);
}

public class ScheduleConfig
{
    /// <summary>onchange | interval | daily | both</summary>
    public string Mode { get; set; } = "onchange";
    public int IntervalMinutes { get; set; } = 60;
    public string DailyTime { get; set; } = "18:00";
}
