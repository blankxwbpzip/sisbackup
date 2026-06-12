using Microsoft.UI.Xaml;
using Microsoft.UI.Dispatching;
using H.NotifyIcon;

namespace SisbackupClient.Services;

/// <summary>
/// System tray icon with status & notification management
/// Uses H.NotifyIcon for WinUI 3 compatibility
/// </summary>
public class TrayIconService : IDisposable
{
    private TaskbarIcon? _icon;
    private string _currentStatus = "idle";

    private readonly Dictionary<string, string> _statusIcons = new()
    {
        ["idle"] = "Assets/tray_idle.ico",
        ["syncing"] = "Assets/tray_syncing.ico",
        ["error"] = "Assets/tray_error.ico",
        ["paused"] = "Assets/tray_paused.ico",
    };

    public void Initialize(DispatcherQueue dispatcher)
    {
        _icon = new TaskbarIcon
        {
            Icon = new System.Drawing.Icon(_statusIcons["idle"]),
            ToolTipText = "Sisbackup - Idle",
            Visibility = Visibility.Visible,
        };

        // Right-click context menu
        _icon.ContextMenu = new()
        {
            new() { Text = "Buka Sisbackup", Command = new RelayCommand(() =>
                App.Current.As<App>()?.ShowMainWindow()) },
            new() { Text = "Sync Sekarang", Command = new RelayCommand(() =>
                OnForceSyncRequested?.Invoke()) },
            new() { Text = "Pause/Resume", Command = new RelayCommand(() =>
                OnPauseToggled?.Invoke()) },
            new() { Separator = true },
            new() { Text = "Keluar", Command = new RelayCommand(() =>
                Environment.Exit(0)) },
        };

        _icon.LeftClick += (_, _) =>
            App.Current.As<App>()?.ShowMainWindow();
    }

    public void UpdateStatus(string status, string tooltip)
    {
        _currentStatus = status;
        if (_icon != null && _statusIcons.TryGetValue(status, out var iconPath))
        {
            if (File.Exists(iconPath))
            {
                _icon.Icon = new System.Drawing.Icon(iconPath);
            }
            _icon.ToolTipText = $"Sisbackup - {tooltip}";
        }
    }

    public void ShowNotification(string title, string body)
    {
        _icon?.ShowNotification(title, body);
    }

    public event Action? OnForceSyncRequested;
    public event Action? OnPauseToggled;

    public void Dispose()
    {
        _icon?.Dispose();
    }
}

internal class RelayCommand : System.Windows.Input.ICommand
{
    private readonly Action _action;
    public RelayCommand(Action action) => _action = action;
    public event EventHandler? CanExecuteChanged;
    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => _action();
}
