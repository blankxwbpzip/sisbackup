using System.IO;
using System.Text.Json;

namespace SisbackupServer.Services;

/// <summary>
/// Central server management — coordinates Node.js process, config, and status
/// </summary>
public class ServerManager
{
    private readonly NodeProcessService _nodeService;
    private readonly FirewallService _firewallService;

    public int Port { get; private set; } = 3001;
    public string StoragePath { get; private set; } = @"D:\BackupSekolah";
    public bool AutoStart { get; set; } = true;
    public bool FirewallEnabled { get; set; } = true;
    public DateTime StartedAt { get; private set; }

    public string ServerUrl => $"http://localhost:{Port}";
    public string LanUrl => $"http://{GetLocalIpAddress()}:{Port}";
    public bool IsRunning => _nodeService.IsRunning;
    public TimeSpan Uptime => DateTime.Now - StartedAt;

    public event Action<string>? LogReceived;
    public event Action<bool>? StatusChanged;

    private readonly string _configPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
        "Sisbackup", "server-config.json");

    public ServerManager()
    {
        _nodeService = new NodeProcessService();
        _firewallService = new FirewallService();

        _nodeService.OutputReceived += msg => LogReceived?.Invoke(msg);
        _nodeService.ErrorReceived += msg => LogReceived?.Invoke($"[ERR] {msg}");
        _nodeService.ProcessStarted += () =>
        {
            StartedAt = DateTime.Now;
            StatusChanged?.Invoke(true);
        };
        _nodeService.ProcessExited += () => StatusChanged?.Invoke(false);

        LoadConfig();
    }

    // ─── Config Persistence ────────────────────────────────

    private void LoadConfig()
    {
        try
        {
            if (File.Exists(_configPath))
            {
                var json = File.ReadAllText(_configPath);
                var config = JsonSerializer.Deserialize<ServerConfig>(json);
                if (config != null)
                {
                    Port = config.Port;
                    StoragePath = config.StoragePath;
                    AutoStart = config.AutoStart;
                    FirewallEnabled = config.FirewallEnabled;
                }
            }
        }
        catch { /* Use defaults */ }
    }

    public void SaveConfig()
    {
        try
        {
            var dir = Path.GetDirectoryName(_configPath)!;
            Directory.CreateDirectory(dir);

            var config = new ServerConfig
            {
                Port = Port,
                StoragePath = StoragePath,
                AutoStart = AutoStart,
                FirewallEnabled = FirewallEnabled,
            };

            File.WriteAllText(_configPath,
                JsonSerializer.Serialize(config, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch (Exception ex)
        {
            LogReceived?.Invoke($"Gagal simpan config: {ex.Message}");
        }
    }

    // ─── Server Control ────────────────────────────────────

    public async Task<bool> StartAsync()
    {
        if (FirewallEnabled)
            _firewallService.AddFirewallRule(Port);

        var ok = await _nodeService.StartAsync(Port);
        if (ok)
            LogReceived?.Invoke($"Server started at {ServerUrl}");
        return ok;
    }

    public async Task StopAsync()
    {
        await _nodeService.StopAsync();
        LogReceived?.Invoke("Server stopped");
    }

    public async Task RestartAsync()
    {
        LogReceived?.Invoke("Restarting server...");
        await _nodeService.RestartAsync(Port);
    }

    // ─── System Info ───────────────────────────────────────

    public (long totalGb, long freeGb) GetDiskInfo()
    {
        try
        {
            var drive = new DriveInfo(Path.GetPathRoot(StoragePath)!);
            return (drive.TotalSize / (1024 * 1024 * 1024),
                    drive.AvailableFreeSpace / (1024 * 1024 * 1024));
        }
        catch { return (0, 0); }
    }

    public static string GetLocalIpAddress()
    {
        try
        {
            using var socket = new System.Net.Sockets.Socket(
                System.Net.Sockets.AddressFamily.InterNetwork,
                System.Net.Sockets.SocketType.Dgram, 0);
            socket.Connect("8.8.8.8", 65530);
            var endPoint = socket.LocalEndPoint as System.Net.IPEndPoint;
            return endPoint?.Address.ToString() ?? "127.0.0.1";
        }
        catch { return "127.0.0.1"; }
    }

    public void Dispose()
    {
        _nodeService.Dispose();
    }
}

internal class ServerConfig
{
    public int Port { get; set; } = 3001;
    public string StoragePath { get; set; } = @"D:\BackupSekolah";
    public bool AutoStart { get; set; } = true;
    public bool FirewallEnabled { get; set; } = true;
}
