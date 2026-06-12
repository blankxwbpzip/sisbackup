using Microsoft.Win32;
using System.Diagnostics;

namespace SisbackupClient.ShellExtensions;

/// <summary>
/// Windows Shell Context Menu Extension
///
/// Adds "Backup to Sisbackup" and "Sync Now" to folder right-click menu.
/// Registered via registry during installation.
///
/// Registry paths:
///   HKCR\Directory\shell\Sisbackup.Backup
///   HKCR\Directory\shell\Sisbackup.SyncNow
/// </summary>
public class ContextMenuHandler
{
    private const string BackupMenuKey = @"Directory\shell\Sisbackup.Backup";
    private const string SyncMenuKey = @"Directory\shell\Sisbackup.SyncNow";
    private const string AppPath = @"C:\Program Files\Sisbackup Client\SisbackupClient.exe";

    public static void Register()
    {
        try
        {
            // "Backup folder ke Sisbackup"
            using (var key = Registry.ClassesRoot.CreateSubKey(BackupMenuKey))
            {
                key.SetValue("", "📦 Backup ke Sisbackup");
                key.SetValue("Icon", $"\"{AppPath}\",0");
            }
            using (var cmdKey = Registry.ClassesRoot.CreateSubKey($"{BackupMenuKey}\\command"))
            {
                cmdKey.SetValue("", $"\"{AppPath}\" --add-folder \"%1\"");
            }

            // "Sync folder sekarang"
            using (var key = Registry.ClassesRoot.CreateSubKey(SyncMenuKey))
            {
                key.SetValue("", "🔄 Sync Sekarang (Sisbackup)");
                key.SetValue("Icon", $"\"{AppPath}\",1");
            }
            using (var cmdKey = Registry.ClassesRoot.CreateSubKey($"{SyncMenuKey}\\command"))
            {
                cmdKey.SetValue("", $"\"{AppPath}\" --sync-now \"%1\"");
            }
        }
        catch (UnauthorizedAccessException)
        {
            // Must run as admin to register shell extensions
        }
    }

    public static void Unregister()
    {
        try
        {
            Registry.ClassesRoot.DeleteSubKeyTree(BackupMenuKey, false);
            Registry.ClassesRoot.DeleteSubKeyTree(SyncMenuKey, false);
        }
        catch { /* Key may not exist */ }
    }
}
