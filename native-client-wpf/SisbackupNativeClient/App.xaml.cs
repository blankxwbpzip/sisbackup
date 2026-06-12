using System.Windows;

namespace SisbackupNativeClient;

public partial class App : Application
{
    private Mutex? _mutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        _mutex = new Mutex(true, "SisbackupClientNative_Instance", out bool createdNew);
        if (!createdNew)
        {
            MessageBox.Show("Sisbackup Client sudah berjalan.\nCek system tray untuk membuka.",
                "Sisbackup", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }
        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _mutex?.ReleaseMutex();
        base.OnExit(e);
    }
}
