using System.Diagnostics;
using System.IO;

namespace SisbackupServer.Services;


/// <summary>
/// Manages the Node.js Fastify server as a child process
/// </summary>
public class NodeProcessService : IDisposable
{
    private Process? _serverProcess;
    private readonly string _serverScriptPath;
    private readonly string _nodeExePath;
    private bool _isRunning;

    public event Action<string>? OutputReceived;
    public event Action<string>? ErrorReceived;
    public event Action? ProcessExited;
    public event Action? ProcessStarted;

    public bool IsRunning => _isRunning && _serverProcess is { HasExited: false };

    public NodeProcessService()
    {
        // Find Node.js in bundled path or system PATH
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        _nodeExePath = FindNodeExecutable(baseDir);
        _serverScriptPath = Path.Combine(baseDir, "NodeServer", "src", "index.js");
    }

    private static string FindNodeExecutable(string baseDir)
    {
        // 1. Check bundled Node.js
        var bundled = Path.Combine(baseDir, "NodeServer", "node", "node.exe");
        if (File.Exists(bundled)) return bundled;

        // 2. Check system PATH
        var pathExt = Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE";
        var paths = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator);
        foreach (var path in paths)
        {
            foreach (var ext in pathExt.Split(';'))
            {
                var fullPath = Path.Combine(path, "node" + ext.ToLower());
                if (File.Exists(fullPath)) return fullPath;
            }
        }

        // 3. Default locations
        var defaultPaths = new[]
        {
            @"C:\Program Files\nodejs\node.exe",
            @"C:\Program Files (x86)\nodejs\node.exe",
        };
        foreach (var p in defaultPaths)
            if (File.Exists(p)) return p;

        return "node.exe"; // Fallback
    }

    public async Task<bool> StartAsync(int port = 3001)
    {
        if (IsRunning) return true;

        if (!File.Exists(_serverScriptPath))
        {
            ErrorReceived?.Invoke($"Server script tidak ditemukan: {_serverScriptPath}");
            return false;
        }

        try
        {
            _serverProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = _nodeExePath,
                    Arguments = $"\"{_serverScriptPath}\"",
                    WorkingDirectory = Path.GetDirectoryName(_serverScriptPath),
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    Environment =
                    {
                        ["PORT"] = port.ToString(),
                        ["HOST"] = "0.0.0.0",
                        ["NODE_ENV"] = "production",
                    }
                },
                EnableRaisingEvents = true,
            };

            _serverProcess.OutputDataReceived += (_, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                    OutputReceived?.Invoke(e.Data);
            };

            _serverProcess.ErrorDataReceived += (_, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data))
                    ErrorReceived?.Invoke(e.Data);
            };

            _serverProcess.Exited += (_, _) =>
            {
                _isRunning = false;
                ProcessExited?.Invoke();
            };

            _serverProcess.Start();
            _serverProcess.BeginOutputReadLine();
            _serverProcess.BeginErrorReadLine();

            // Wait briefly for startup
            await Task.Delay(2000);

            _isRunning = !_serverProcess.HasExited;
            if (_isRunning)
                ProcessStarted?.Invoke();

            return _isRunning;
        }
        catch (Exception ex)
        {
            ErrorReceived?.Invoke($"Gagal start server: {ex.Message}");
            _isRunning = false;
            return false;
        }
    }

    public async Task StopAsync()
    {
        if (_serverProcess == null || _serverProcess.HasExited)
        {
            _isRunning = false;
            return;
        }

        try
        {
            // Try graceful shutdown first
            _serverProcess.CloseMainWindow();

            // Wait up to 5 seconds
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await Task.Run(() => _serverProcess.WaitForExit(), cts.Token);
        }
        catch (OperationCanceledException)
        {
            // Force kill
            _serverProcess.Kill();
        }

        _isRunning = false;
        _serverProcess.Dispose();
        _serverProcess = null;
    }

    public async Task RestartAsync(int port = 3001)
    {
        await StopAsync();
        await Task.Delay(1000);
        await StartAsync(port);
    }

    public void Dispose()
    {
        _serverProcess?.Kill();
        _serverProcess?.Dispose();
    }
}
