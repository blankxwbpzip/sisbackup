using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using SisbackupClient.Services;
using System.Collections.ObjectModel;
using System.Diagnostics;

namespace SisbackupClient;

public sealed partial class MainWindow : Window
{
    private readonly SyncService _syncService = new();
    private readonly AppConfig _config = AppConfig.Load();
    private readonly ObservableCollection<FolderItem> _folders = new();
    private readonly ObservableCollection<DestinationItem> _destinations = new();

    public MainWindow()
    {
        this.InitializeComponent();

        LoadFolders();
        LoadDestinations();
        UpdateStorageBar();

        // Sync status events
        _syncService.SyncProgressChanged += (s, p) =>
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                TxtLastSync.Text = $"Syncing... {p.ProgressPercent:F0}% ({p.FilesDone}/{p.FilesTotal} files)";
            });
        };

        _syncService.SyncCompleted += (s, stats) =>
        {
            DispatcherQueue.TryEnqueue(() =>
            {
                TxtLastSync.Text = stats.Success
                    ? $"Sync terakhir: baru saja ✅ ({stats.FilesSynced} files)"
                    : $"Sync gagal ❌";
            });
        };
    }

    private void LoadFolders()
    {
        _folders.Clear();
        foreach (var folder in _config.WatchFolders)
        {
            _folders.Add(new FolderItem
            {
                Path = folder,
                Status = _config.Paused ? "⏸ Paused" : "✅ Synced",
            });
        }
        LstFolders.ItemsSource = _folders;
    }

    private void LoadDestinations()
    {
        _destinations.Clear();
        foreach (var dest in _config.Destinations)
        {
            _destinations.Add(new DestinationItem
            {
                Icon = dest.DestType switch
                {
                    "local_server" => "🏫",
                    "google_drive" => "📗",
                    "onedrive" => "🔵",
                    "local" => "💾",
                    _ => "📁",
                },
                Label = dest.Label,
                Detail = dest.IsEnabled ? "🟢 Aktif" : "⚪ Nonaktif",
            });
        }
        LstDestinations.ItemsSource = _destinations;
    }

    private void UpdateStorageBar()
    {
        // Would fetch from server in production
        StorageBar.Value = 46;
        TxtStorage.Text = "2.3 GB / 5 GB";
        TxtLastSync.Text = "Sync terakhir: 2 menit lalu ✅";
    }

    // ─── Button Handlers ───────────────────────────────────

    private async void BtnSyncNow_Click(object sender, RoutedEventArgs e)
    {
        BtnSyncNow.IsEnabled = false;
        try
        {
            foreach (var folder in _config.WatchFolders)
            {
                foreach (var dest in _config.Destinations.Where(d => d.IsEnabled))
                {
                    await _syncService.SyncFolderAsync(folder, dest.DestType, dest.Config);
                }
            }
            LoadFolders();
        }
        finally
        {
            BtnSyncNow.IsEnabled = true;
        }
    }

    private void BtnPause_Click(object sender, RoutedEventArgs e)
    {
        _config.Paused = !_config.Paused;
        _config.Save();
        BtnPause.Content = _config.Paused ? "▶ Resume" : "⏸ Pause";
        LoadFolders();
    }

    private async void BtnAddFolder_Click(object sender, RoutedEventArgs e)
    {
        var picker = new Windows.Storage.Pickers.FolderPicker();
        var hwnd = WinRT.Interop.WindowNative.GetWindowHandle(this);
        WinRT.Interop.InitializeWithWindow.Initialize(picker, hwnd);
        picker.SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.Desktop;

        var folder = await picker.PickSingleFolderAsync();
        if (folder != null)
        {
            _config.WatchFolders.Add(folder.Path);
            _config.Save();
            LoadFolders();
        }
    }

    private async void BtnAddDest_Click(object sender, RoutedEventArgs e)
    {
        // Show destination dialog (simplified — would use ContentDialog in production)
        var dialog = new ContentDialog
        {
            Title = "Tambah Tujuan Backup",
            PrimaryButtonText = "Tambah",
            CloseButtonText = "Batal",
            DefaultButton = ContentDialogButton.Primary,
            XamlRoot = this.Content.XamlRoot,
            Content = new StackPanel
            {
                Children =
                {
                    new ComboBox
                    {
                        PlaceholderText = "Pilih tipe tujuan",
                        Items = { "Server Sekolah", "Google Drive", "OneDrive", "Folder Lokal" },
                        SelectedIndex = 0,
                    },
                },
            },
        };

        await dialog.ShowAsync();
        // In production, would parse the result and add to config
    }
}

public class FolderItem
{
    public string Path { get; set; } = "";
    public string Status { get; set; } = "";
}

public class DestinationItem
{
    public string Icon { get; set; } = "";
    public string Label { get; set; } = "";
    public string Detail { get; set; } = "";
}
