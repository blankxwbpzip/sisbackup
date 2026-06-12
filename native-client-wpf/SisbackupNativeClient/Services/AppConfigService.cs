using System.IO;
using System.Text.Json;

namespace SisbackupNativeClient.Services;

public class AppConfig
{
    public string ServerUrl { get; set; } = "";
    public string Username { get; set; } = "";
    public string Token { get; set; } = "";
    public bool AutoStart { get; set; } = true;
    public bool MinimizeToTray { get; set; } = true;
    public List<WatchFolder> Folders { get; set; } = new();
    public List<SyncTarget> Destinations { get; set; } = new();
    public bool Paused { get; set; } = false;

    private static string ConfigPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Sisbackup", "Client", "config.json");

    public static AppConfig Load()
    {
        try
        {
            if (File.Exists(ConfigPath))
                return JsonSerializer.Deserialize<AppConfig>(File.ReadAllText(ConfigPath)) ?? new();
        }
        catch { }
        return new AppConfig();
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath)!);
        File.WriteAllText(ConfigPath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
    }
}

public class WatchFolder
{
    public string Path { get; set; } = "";
    public bool IsPaused { get; set; } = false;
    public string Schedule { get; set; } = "realtime";
    public string IncludePattern { get; set; } = "";
    public string ExcludePattern { get; set; } = "";
}

public class SyncTarget
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "local_server";
    public string Host { get; set; } = "";
    public int Port { get; set; } = 3001;
    public string RemotePath { get; set; } = "/backup";
    public string Username { get; set; } = "";
    public bool IsEnabled { get; set; } = true;
}
