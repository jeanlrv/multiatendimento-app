using Newtonsoft.Json;

namespace KBAgent;

public static class ConfigManager
{
    private static readonly string ConfigPath = Path.Combine(
        AppContext.BaseDirectory, "appsettings.json");

    public static AgentConfig Load()
    {
        if (!File.Exists(ConfigPath))
            return new AgentConfig();

        try
        {
            var json = File.ReadAllText(ConfigPath);
            var root = JsonConvert.DeserializeObject<Dictionary<string, AgentConfig>>(json);
            return root?.GetValueOrDefault("KBAgent") ?? new AgentConfig();
        }
        catch
        {
            return new AgentConfig();
        }
    }

    public static void Save(AgentConfig config)
    {
        var root = new { KBAgent = config };
        var json = JsonConvert.SerializeObject(root, Formatting.Indented);
        File.WriteAllText(ConfigPath, json);
    }

    /// <summary>Registro no HKCU Run para iniciar com o Windows.</summary>
    public static void SetStartWithWindows(bool enable)
    {
        const string key = @"Software\Microsoft\Windows\CurrentVersion\Run";
        const string valueName = "KBAgent";

        using var regKey = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(key, writable: true);
        if (regKey == null) return;

        if (enable)
            regKey.SetValue(valueName, $"\"{Environment.ProcessPath}\"");
        else
            regKey.DeleteValue(valueName, throwOnMissingValue: false);
    }
}
