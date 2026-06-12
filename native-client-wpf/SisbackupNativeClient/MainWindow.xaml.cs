using System.Collections.ObjectModel;
using System.Net.Http;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using SisbackupNativeClient.Services;

namespace SisbackupNativeClient;

public partial class MainWindow : Window
{
    private readonly AppConfig _config;
    private readonly SyncEngine _sync;
    private readonly ObservableCollection<FolderItem> _folders = new();
    private readonly ObservableCollection<DestItem> _destinations = new();
    private bool _paused;
    private DateTime? _lastSyncTime;

    public MainWindow()
    {
        InitializeComponent();
        _config = AppConfig.Load();
        _sync = new SyncEngine();

        LstFolders.ItemsSource = _folders;
        LstDestinations.ItemsSource = _destinations;

        _sync.LogReceived += msg => Dispatcher.Invoke(() =>
        {
            LstLogs.Items.Insert(0, $"[{DateTime.Now:HH:mm:ss}] {msg}");
            if (LstLogs.Items.Count > 200) LstLogs.Items.RemoveAt(LstLogs.Items.Count - 1);
        });

        _sync.ProgressChanged += p => Dispatcher.Invoke(() =>
        {
            TxtFooter.Text = $"Syncing... {p.Percent}% ({p.FilesDone}/{p.FilesTotal} files)";
        });

        _sync.SyncCompleted += r => Dispatcher.Invoke(() =>
        {
            _lastSyncTime = r.CompletedAt;
            TxtLastSyncTime.Text = $"Last sync: {r.CompletedAt:HH:mm}";
            TxtFooter.Text = r.Success ? "Sync complete ✅" : $"Sync failed: {r.Message}";
        });

        LoadConfig();
    }

    private void LoadConfig()
    {
        TxtServerAddress.Text = _config.ServerUrl;
        TxtUsername.Text = _config.Username;
        ChkAutoStart.IsChecked = _config.AutoStart;
        ChkMinimizeToTray.IsChecked = _config.MinimizeToTray;
        _paused = _config.Paused;
        RefreshFolderList();
        RefreshDestList();
        UpdateStatusUI();
    }

    private void SaveConfig()
    {
        _config.ServerUrl = TxtServerAddress.Text.Trim();
        _config.Username = TxtUsername.Text.Trim();
        _config.AutoStart = ChkAutoStart.IsChecked == true;
        _config.MinimizeToTray = ChkMinimizeToTray.IsChecked == true;
        _config.Paused = _paused;
        _config.Folders = _folders.Select(f => new WatchFolder { Path = f.Path, IsPaused = f.IsPaused, Schedule = "realtime" }).ToList();
        _config.Destinations = _destinations.Select(d => new SyncTarget { Name = d.Name, Type = d.Type, Host = d.Host, Port = d.Port, RemotePath = d.RemotePath, IsEnabled = true }).ToList();
        _config.Save();
    }

    private void RefreshFolderList()
    {
        _folders.Clear();
        foreach (var f in _config.Folders)
            _folders.Add(new FolderItem { Path = f.Path, IsPaused = f.IsPaused || _paused, StatusText = (_paused || f.IsPaused) ? "⏸ Paused" : "✅ Ready" });
    }

    private void RefreshDestList()
    {
        _destinations.Clear();
        foreach (var d in _config.Destinations)
            _destinations.Add(new DestItem { Name = d.Name, Type = d.Type, Host = d.Host, Port = d.Port, RemotePath = d.RemotePath, Icon = d.Type switch { "local_server" => "🏫", "google_drive" => "📗", "onedrive" => "🔵", _ => "💾" }, DetailText = d.IsEnabled ? $"🟢 {d.Host}:{d.Port}{d.RemotePath}" : "⚪ Disabled" });
    }

    private void BtnAddFolder_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog
        {
            Title = "Pilih folder yang ingin di-backup",
            Multiselect = false,
        };
        if (dlg.ShowDialog() == true)
        {
            _config.Folders.Add(new WatchFolder { Path = dlg.FolderName });
            SaveConfig(); RefreshFolderList();
        }
    }

    private void BtnToggleFolder_Click(object sender, RoutedEventArgs e)
    {
        if ((sender as Button)?.Tag is FolderItem item) { item.IsPaused = !item.IsPaused; item.StatusText = item.IsPaused ? "⏸ Paused" : "✅ Ready"; RefreshFolderList(); SaveConfig(); }
    }

    private void BtnRemoveFolder_Click(object sender, RoutedEventArgs e)
    {
        if ((sender as Button)?.Tag is FolderItem item) { _config.Folders.RemoveAll(f => f.Path == item.Path); SaveConfig(); RefreshFolderList(); }
    }

    private void BtnAddDest_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Window { Title = "Tambah Tujuan Backup", Width = 400, Height = 350, WindowStartupLocation = WindowStartupLocation.CenterOwner, Owner = this, ResizeMode = ResizeMode.NoResize };
        var panel = new StackPanel { Margin = new Thickness(20, 20, 20, 20) };
        panel.Children.Add(new TextBlock { Text = "Nama", FontSize = 12, Margin = new Thickness(0, 0, 0, 4) });
        var txtName = new TextBox { Text = "Server Sekolah", FontSize = 13, Padding = new Thickness(6, 4, 6, 4) };
        panel.Children.Add(txtName);
        panel.Children.Add(new TextBlock { Text = "Host / IP", FontSize = 12, Margin = new Thickness(0, 12, 0, 4) });
        var txtHost = new TextBox { Text = "192.168.1.100", FontSize = 13, Padding = new Thickness(6, 4, 6, 4) };
        panel.Children.Add(txtHost);
        panel.Children.Add(new TextBlock { Text = "Port", FontSize = 12, Margin = new Thickness(0, 12, 0, 4) });
        var txtPort = new TextBox { Text = "3001", FontSize = 13, Padding = new Thickness(6, 4, 6, 4) };
        panel.Children.Add(txtPort);
        panel.Children.Add(new TextBlock { Text = "Remote Path", FontSize = 12, Margin = new Thickness(0, 12, 0, 4) });
        var txtPath = new TextBox { Text = "/backup", FontSize = 13, Padding = new Thickness(6, 4, 6, 4) };
        panel.Children.Add(txtPath);
        var btnAdd = new Button { Content = "✅ Tambah", FontSize = 13, FontWeight = FontWeights.SemiBold, Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2563EB")), Foreground = Brushes.White, Padding = new Thickness(16, 10, 16, 10), Margin = new Thickness(0, 20, 0, 0), BorderThickness = new Thickness(0, 0, 0, 0) };
        btnAdd.Click += (_, _) => { _config.Destinations.Add(new SyncTarget { Name = txtName.Text, Type = "local_server", Host = txtHost.Text, Port = int.TryParse(txtPort.Text, out var p) ? p : 3001, RemotePath = txtPath.Text }); SaveConfig(); RefreshDestList(); dialog.Close(); };
        panel.Children.Add(btnAdd);
        dialog.Content = panel;
        dialog.ShowDialog();
    }

    private void BtnRemoveDest_Click(object sender, RoutedEventArgs e)
    {
        if ((sender as Button)?.Tag is DestItem item) { _config.Destinations.RemoveAll(d => d.Name == item.Name); SaveConfig(); RefreshDestList(); }
    }

    private async void BtnSyncNow_Click(object sender, RoutedEventArgs e)
    {
        BtnSyncNow.IsEnabled = false;
        await SyncAllFolders();
        BtnSyncNow.IsEnabled = true;
    }

    private async Task SyncAllFolders()
    {
        if (_paused) return;
        var activeFolders = _folders.Where(f => !f.IsPaused).ToList();
        var activeDests = _config.Destinations.Where(d => d.IsEnabled).ToList();
        LstLogs.Items.Insert(0, $"[{DateTime.Now:HH:mm:ss}] Sync: {activeFolders.Count} folders → {activeDests.Count} targets");
        foreach (var folder in activeFolders)
            foreach (var dest in activeDests)
                await _sync.SyncFolderAsync(new WatchFolder { Path = folder.Path }, dest);
    }

    private void BtnPause_Click(object sender, RoutedEventArgs e) { _paused = !_paused; BtnPause.Content = _paused ? "▶ Resume" : "⏸ Pause"; BtnPause.Background = _paused ? new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10B981")) : new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F59E0B")); SaveConfig(); RefreshFolderList(); }

    private async void BtnConnect_Click(object sender, RoutedEventArgs e)
    {
        var server = TxtServerAddress.Text.Trim();
        if (string.IsNullOrWhiteSpace(server)) return;
        BtnConnect.IsEnabled = false;
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            var resp = await http.GetAsync($"{server}/api/health");
            if (resp.IsSuccessStatusCode) { UpdateStatusUI(true, server); _config.ServerUrl = server; SaveConfig(); LstLogs.Items.Insert(0, $"[{DateTime.Now:HH:mm:ss}] ✅ Connected to {server}"); }
            else { UpdateStatusUI(false); LstLogs.Items.Insert(0, $"[{DateTime.Now:HH:mm:ss}] ❌ Server returned {resp.StatusCode}"); }
        }
        catch { UpdateStatusUI(false); LstLogs.Items.Insert(0, $"[{DateTime.Now:HH:mm:ss}] ❌ Cannot reach {server}"); }
        BtnConnect.IsEnabled = true;
    }

    private void BtnSaveSettings_Click(object sender, RoutedEventArgs e) { SaveConfig(); MessageBox.Show("Pengaturan disimpan.", "Sisbackup", MessageBoxButton.OK, MessageBoxImage.Information); }

    private void UpdateStatusUI(bool connected = false, string? serverUrl = null)
    {
        if (connected) { StatusDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#10B981")); TxtStatus.Text = "Connected"; TxtServerUrl.Text = serverUrl ?? _config.ServerUrl; }
        else { StatusDot.Fill = new SolidColorBrush(Colors.Gray); TxtStatus.Text = "Disconnected"; TxtServerUrl.Text = string.IsNullOrEmpty(_config.ServerUrl) ? "Belum terhubung ke server" : $"Server: {_config.ServerUrl} (offline)"; }
    }

    private void Window_Loaded(object sender, RoutedEventArgs e) { }
    private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e) { SaveConfig(); }
}

public class FolderItem
{
    public string Path { get; set; } = "";
    public bool IsPaused { get; set; }
    public string StatusText { get; set; } = "";
}

public class DestItem
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Host { get; set; } = "";
    public int Port { get; set; }
    public string RemotePath { get; set; } = "";
    public string Icon { get; set; } = "";
    public string DetailText { get; set; } = "";
}
