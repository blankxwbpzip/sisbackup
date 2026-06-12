using System.Windows;
using System.Windows.Threading;

namespace SisbackupServer;

public partial class App : Application
{
    private NotifyIcon? _trayIcon;
    private Mutex? _mutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Single instance check
        _mutex = new Mutex(true, "SisbackupServer_Instance", out bool createdNew);
        if (!createdNew)
        {
            MessageBox.Show("Sisbackup Server sudah berjalan.\nCek system tray untuk membuka.",
                "Sisbackup Server", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }

        // Global exception handler
        DispatcherUnhandledException += (s, e) =>
        {
            MessageBox.Show($"Terjadi error: {e.Exception.Message}\n\nServer akan tetap berjalan.",
                "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            e.Handled = true;
        };
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _trayIcon?.Dispose();
        _mutex?.ReleaseMutex();
        base.OnExit(e);
    }
}
