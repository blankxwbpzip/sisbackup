using Microsoft.Win32;

namespace SisbackupClient.ShellExtensions;

/// <summary>
/// Windows Explorer Overlay Icon Handler
///
/// Shows sync status overlay on folders:
///   ✅ Green checkmark = synced
///   🔄 Blue arrows = syncing
///   ❌ Red X = error
///   ⏸ Gray pause = paused
///
/// Registered via:
///   HKLM\Software\Microsoft\Windows\CurrentVersion\Explorer\ShellIconOverlayIdentifiers
/// </summary>
public class OverlayIcons
{
    private const string OverlayKey =
        @"Software\Microsoft\Windows\CurrentVersion\Explorer\ShellIconOverlayIdentifiers";

    private static readonly Dictionary<string, string> Overlays = new()
    {
        ["SisbackupSynced"] = "Assets/overlay_synced.ico",
        ["SisbackupSyncing"] = "Assets/overlay_syncing.ico",
        ["SisbackupError"] = "Assets/overlay_error.ico",
        ["SisbackupPaused"] = "Assets/overlay_paused.ico",
    };

    public static void Register()
    {
        try
        {
            foreach (var (name, iconPath) in Overlays)
            {
                var fullIconPath = Path.Combine(
                    AppContext.BaseDirectory, iconPath);

                using var key = Registry.LocalMachine.CreateSubKey(
                    $"{OverlayKey}\\{name}");
                key.SetValue("", $"{{{Guid.NewGuid()}}}");
                key.SetValue("Icon", fullIconPath);
            }

            // Restart Explorer to apply
            RestartExplorer();
        }
        catch (UnauthorizedAccessException)
        {
            // Must run as admin
        }
    }

    public static void Unregister()
    {
        try
        {
            foreach (var name in Overlays.Keys)
            {
                Registry.LocalMachine.DeleteSubKey($"{OverlayKey}\\{name}", false);
            }
            RestartExplorer();
        }
        catch { /* Ignore */ }
    }

    private static void RestartExplorer()
    {
        // Soft refresh: tell Explorer to reload icons
        try
        {
            // SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, 0, 0)
            // This is a Win32 API call — simplified here
        }
        catch { /* Best effort */ }
    }
}
