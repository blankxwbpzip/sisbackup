using System.Diagnostics;
using System.Text.RegularExpressions;
using System.IO;

namespace SisbackupNativeClient.Services;


public class SyncEngine
{
    public event Action<string>? LogReceived;
    public event Action<SyncProgress>? ProgressChanged;
    public event Action<SyncResult>? SyncCompleted;

    private static string FindRclone()
    {
        var bundled = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "rclone", "rclone.exe");
        if (File.Exists(bundled)) return bundled;

        foreach (var dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator))
        {
            var p = System.IO.Path.Combine(dir, "rclone.exe");
            if (File.Exists(p)) return p;
        }
        return "rclone.exe";
    }

    public async Task<SyncResult> SyncFolderAsync(WatchFolder folder, SyncTarget target)
    {
        var rclone = FindRclone();
        var result = new SyncResult { Folder = folder.Path, Target = target.Name };

        var args = new List<string> { "sync", $"\"{folder.Path}\"", BuildDest(target), "--progress", "--stats", "5s" };
        if (!string.IsNullOrWhiteSpace(folder.ExcludePattern))
            args.Add($"--exclude \"{folder.ExcludePattern}\"");
        if (!string.IsNullOrWhiteSpace(folder.IncludePattern))
            args.Add($"--include \"{folder.IncludePattern}\"");

        LogReceived?.Invoke($"rclone {string.Join(" ", args)}");

        try
        {
            using var proc = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = rclone,
                    Arguments = string.Join(" ", args),
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                },
                EnableRaisingEvents = true,
            };

            proc.OutputDataReceived += (_, e) =>
            {
                if (string.IsNullOrEmpty(e.Data)) return;
                var prog = ParseProgress(e.Data);
                if (prog != null) ProgressChanged?.Invoke(prog);
            };

            proc.ErrorDataReceived += (_, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data)) LogReceived?.Invoke($"[ERR] {e.Data}");
            };

            proc.Start();
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();
            await proc.WaitForExitAsync();

            result.Success = proc.ExitCode == 0;
            result.Message = proc.ExitCode == 0 ? "Sync berhasil" : "Sync gagal";
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = ex.Message;
        }

        SyncCompleted?.Invoke(result);
        return result;
    }

    private static string BuildDest(SyncTarget t) => t.Type switch
    {
        "local_server" => $":sftp:{t.Username}@{t.Host}:{t.RemotePath}",
        "google_drive" => $"gdrive:Sisbackup",
        "onedrive" => $"onedrive:Sisbackup",
        "local" => $"\"{t.RemotePath}\"",
        _ => $"\"{t.RemotePath}\""
    };

    private static SyncProgress? ParseProgress(string line)
    {
        try
        {
            var fm = Regex.Match(line, @"(\d+)/(\d+)\s+files");
            var pm = Regex.Match(line, @"(\d+)%");
            if (!fm.Success && !pm.Success) return null;
            return new SyncProgress
            {
                FilesDone = fm.Success ? int.Parse(fm.Groups[1].Value) : 0,
                FilesTotal = fm.Success ? int.Parse(fm.Groups[2].Value) : 0,
                Percent = pm.Success ? int.Parse(pm.Groups[1].Value) : 0,
            };
        }
        catch { return null; }
    }
}

public class SyncProgress
{
    public int FilesDone { get; set; }
    public int FilesTotal { get; set; }
    public int Percent { get; set; }
}

public class SyncResult
{
    public bool Success { get; set; }
    public string Folder { get; set; } = "";
    public string Target { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTime CompletedAt { get; set; } = DateTime.Now;
}
