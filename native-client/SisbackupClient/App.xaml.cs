using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SisbackupClient.Services;
using System;
using System.Threading.Tasks;
using WinRT;

namespace SisbackupClient;

public partial class App : Application
{
    private Window? _mainWindow;
    private SyncService? _syncService;
    private TrayIconService? _trayService;

    public App()
    {
        this.InitializeComponent();
    }

    protected override void OnLaunched(Microsoft.UI.Xaml.LaunchActivatedEventArgs args)
    {
        _mainWindow = new MainWindow();

        // Initialize services
        InitializeServices();

        _mainWindow.Activate();
    }

    private void InitializeServices()
    {
        _syncService = new SyncService();
        _trayService = new TrayIconService();

        // Background sync engine
        _syncService.SyncStarted += (s, e) =>
            _trayService.UpdateStatus("syncing", "Sync in progress...");
        _syncService.SyncCompleted += (s, stats) =>
            _trayService.UpdateStatus("idle", $"Sync complete: {stats.FilesSynced} files");
        _syncService.SyncError += (s, err) =>
            _trayService.UpdateStatus("error", err);

        // Start background watcher
        Task.Run(() => _syncService.StartFileWatcherAsync());
    }
}
