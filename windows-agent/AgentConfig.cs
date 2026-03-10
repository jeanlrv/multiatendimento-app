namespace KBAgent;

public class AgentConfig
{
    public string WebhookUrl { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public string WatchFolder { get; set; } = "";
    public string FilePattern { get; set; } = "*.pdf;*.xlsx;*.xls;*.csv;*.txt;*.docx;*.json;*.xml";
    public int DebounceMs { get; set; } = 2000;
    public int RetryAttempts { get; set; } = 3;
    public int RetryDelaySeconds { get; set; } = 30;
    public bool UploadOnStartup { get; set; } = true;
    public ScheduleConfig Schedule { get; set; } = new();
    public bool StartWithWindows { get; set; } = false;

    public string UploadUrl => $"{WebhookUrl.TrimEnd('/')}/{ApiKey}/upload"
        .Replace("/upload/upload", "/upload"); // guard

    public bool IsConfigured => !string.IsNullOrWhiteSpace(WebhookUrl) &&
                                !string.IsNullOrWhiteSpace(ApiKey) &&
                                !string.IsNullOrWhiteSpace(WatchFolder);
}

public class ScheduleConfig
{
    /// <summary>onchange | interval | daily | both</summary>
    public string Mode { get; set; } = "onchange";
    public int IntervalMinutes { get; set; } = 60;
    public string DailyTime { get; set; } = "18:00";
}
