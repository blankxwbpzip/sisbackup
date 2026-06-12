using System.Text.Json;

namespace SisbackupClient.Services;

/// <summary>
/// Application configuration — stored in %LocalAppData%\Sisbackup\Client
/// </summary>
public class AppConfig
{
    private static readonly string ConfigDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "Sisbackup", "Client");
    private static readonly string ConfigPath = Path.Combine(ConfigDir, "config.json");

    public string ServerUrl { get; set; } = "http://192.168.1.100:3001";
    public string AuthToken { get; set; } = "";
    public string Username { get; set; } = "";
    public bool AutoStart { get; set; } = true;
    public bool MinimizeToTray { get; set; } = true;
    public bool StartMinimized { get; set; } = false;
    public List<string> WatchFolders { get; set; } = new();
    public List<SyncDestination> Destinations { get; set; } = new();
    public bool Paused { get; set; } = false;

    // ─── Load/Save ────────────────────────────────────────

    public static AppConfig Load()
    {
        try
        {
            if (File.Exists(ConfigPath))
            {
                var json = File.ReadAllText(ConfigPath);
                return JsonSerializer.Deserialize<AppConfig>(json) ?? new AppConfig();
            }
        }
        catch { /* Return defaults */ }
        return new AppConfig();
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(ConfigDir);
            var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(ConfigPath, json);
        }
        catch { /* Silently fail */ }
    }

    // ─── Credential Manager (Windows) ──────────────────────

    public void SaveToken(string token)
    {
        AuthToken = token;
        // In production: use Windows Credential Manager
        // CredentialManager.WriteCredential("Sisbackup", token);
        Save();
    }

    public string? LoadToken()
    {
        // In production: read from Windows Credential Manager
        return string.IsNullOrEmpty(AuthToken) ? null : AuthToken;
    }
}

public class SyncDestination
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string DestType { get; set; } = "local_server"; // local_server, google_drive, onedrive, local
    public object Config { get; set; } = new();
    public bool IsEnabled { get; set; } = true;
}
