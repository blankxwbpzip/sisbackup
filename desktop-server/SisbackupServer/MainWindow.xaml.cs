using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using SisbackupServer.Services;

namespace SisbackupServer;

public partial class MainWindow : Window
{
    private readonly ServerManager _serverManager;
    private readonly DispatcherTimer _uiTimer;
    private System.Windows.Forms.NotifyIcon? _trayIcon;

    public MainWindow()
    {
        InitializeComponent();
        _serverManager = new ServerManager();

        // ─── Event Handlers ────────────────────────────
        _serverManager.LogReceived += OnLogReceived;
        _serverManager.StatusChanged += OnStatusChanged;

        // ─── UI Update Timer ───────────────────────────
        _uiTimer = new DispatcherTimer(
            TimeSpan.FromSeconds(3),
            DispatcherPriority.Normal,
            (s, e) => UpdateStats(),
            Dispatcher.CurrentDispatcher);
        _uiTimer.Start();

        // ─── Load config into UI ────────────────────────
        TxtStoragePath.Text = _serverManager.StoragePath;
        TxtPort.Text = _serverManager.Port.ToString();
        ChkAutoStart.IsChecked = _serverManager.AutoStart;
        ChkFirewall.IsChecked = _serverManager.FirewallEnabled;

        // ─── Setup System Tray ──────────────────────────
        SetupTrayIcon();

        // ─── Initial state ──────────────────────────────
        UpdateButtonStates(false);
        UpdateStats();

        // ─── Auto-start if configured ───────────────────
        if (_serverManager.AutoStart)
        {
            Loaded += async (_, _) =>
            {
                await Task.Delay(1000);
                await StartServer();
            };
        }
    }

    // ─── System Tray ──────────────────────────────────────

    private void SetupTrayIcon()
    {
        _trayIcon = new System.Windows.Forms.NotifyIcon
        {
            Text = "Sisbackup Server - Stopped",
            Visible = true,
        };

        // Use default application icon or system icon
        try
        {
            using var stream = System.Reflection.Assembly.GetExecutingAssembly()
                .GetManifestResourceStream("SisbackupServer.Resources.app.ico");
            if (stream != null)
                _trayIcon.Icon = new System.Drawing.Icon(stream);
        }
        catch
        {
            // Use default icon from system
        }

        var contextMenu = new System.Windows.Forms.ContextMenuStrip();
        contextMenu.Items.Add("Buka Sisbackup Server", null, (_, _) =>
        {
            Show();
            WindowState = WindowState.Normal;
            Activate();
        });
        contextMenu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
        contextMenu.Items.Add("Start Server", null, async (_, _) => await StartServer());
        contextMenu.Items.Add("Stop Server", null, async (_, _) => await _serverManager.StopAsync());
        contextMenu.Items.Add(new System.Windows.Forms.ToolStripSeparator());
        contextMenu.Items.Add("Keluar", null, (_, _) => Application.Current.Shutdown());

        _trayIcon.ContextMenuStrip = contextMenu;
        _trayIcon.DoubleClick += (_, _) => { Show(); WindowState = WindowState.Normal; Activate(); };
    }

    // ─── Server Control ───────────────────────────────────

    private async void BtnStart_Click(object sender, RoutedEventArgs e) => await StartServer();
    private async void BtnStop_Click(object sender, RoutedEventArgs e)
    {
        await _serverManager.StopAsync();
        UpdateButtonStates(false);
    }

    private async void BtnRestart_Click(object sender, RoutedEventArgs e)
    {
        BtnRestart.IsEnabled = false;
        await _serverManager.RestartAsync();
        BtnRestart.IsEnabled = true;
    }

    private async Task StartServer()
    {
        BtnStart.IsEnabled = false;

        if (int.TryParse(TxtPort.Text, out int port))
            _serverManager.Port = port;

        var ok = await _serverManager.StartAsync();
        UpdateButtonStates(ok);

        if (ok)
        {
            ServerUrlText.Text = $"http://localhost:{_serverManager.Port}";
            LanUrlText.Text = $"LAN: http://{ServerManager.GetLocalIpAddress()}:{_serverManager.Port}";
            if (_trayIcon != null) _trayIcon.Text = $"Sisbackup Server - Port {_serverManager.Port}";
        }
        else
        {
            MessageBox.Show("Gagal menjalankan server.\nPeriksa log untuk detail error.",
                "Error", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    // ─── UI Updates ───────────────────────────────────────

    private void OnLogReceived(string message)
    {
        Dispatcher.Invoke(() =>
        {
            var timestamp = DateTime.Now.ToString("HH:mm:ss");
            LstLogs.Items.Insert(0, $"[{timestamp}] {message}");
            while (LstLogs.Items.Count > 500)
                LstLogs.Items.RemoveAt(LstLogs.Items.Count - 1);
        });
    }

    private void OnStatusChanged(bool isRunning)
    {
        Dispatcher.Invoke(() => UpdateButtonStates(isRunning));
    }

    private void UpdateButtonStates(bool isRunning)
    {
        BtnStart.IsEnabled = !isRunning;
        BtnStop.IsEnabled = isRunning;
        BtnRestart.IsEnabled = isRunning;

        if (isRunning)
        {
            StatusDot.Fill = new SolidColorBrush((Color)FindResource("SuccessColor"));
            StatusText.Text = "Server Running";
            TxtFooter.Text = $"Sisbackup Server v2.6.0 — Running on port {_serverManager.Port}";
            if (_trayIcon != null) _trayIcon.Text = $"Sisbackup Server - Running :{_serverManager.Port}";
        }
        else
        {
            StatusDot.Fill = new SolidColorBrush(Colors.Gray);
            StatusText.Text = "Server Stopped";
            UptimeText.Text = "";
            TxtFooter.Text = "Sisbackup Server v2.6.0 — Stopped";
            if (_trayIcon != null) _trayIcon.Text = "Sisbackup Server - Stopped";
        }
    }

    private void UpdateStats()
    {
        if (_serverManager.IsRunning)
            UptimeText.Text = $"Uptime: {_serverManager.Uptime:dd\\d\\ hh\\h\\ mm\\m}";

        var (totalGb, freeGb) = _serverManager.GetDiskInfo();
        StatDisk.Text = totalGb > 0 ? $"{totalGb - freeGb}/{totalGb} GB" : "N/A";
        StatUsers.Text = "—";
        StatActiveSyncs.Text = "—";
        StatQueue.Text = "—";
    }

    // ─── Config Actions ───────────────────────────────────

    private void BtnBrowseStorage_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new System.Windows.Forms.FolderBrowserDialog
        {
            Description = "Pilih folder penyimpanan backup",
            UseDescriptionForTitle = true,
            SelectedPath = TxtStoragePath.Text,
        };

        if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            TxtStoragePath.Text = dialog.SelectedPath;
    }

    private void BtnSaveConfig_Click(object sender, RoutedEventArgs e)
    {
        _serverManager.StoragePath = TxtStoragePath.Text;
        if (int.TryParse(TxtPort.Text, out int port))
            _serverManager.Port = port;
        _serverManager.AutoStart = ChkAutoStart.IsChecked == true;
        _serverManager.FirewallEnabled = ChkFirewall.IsChecked == true;
        _serverManager.SaveConfig();

        MessageBox.Show("Konfigurasi disimpan.\nRestart server untuk menerapkan perubahan port/storage.",
            "Konfigurasi", MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private void BtnOpenWebAdmin_Click(object sender, RoutedEventArgs e)
    {
        var url = $"http://localhost:{_serverManager.Port}";
        Process.Start(new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true,
        });
    }

    // ─── Window Events ────────────────────────────────────

    private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
    {
        if (_trayIcon != null)
        {
            e.Cancel = true;
            Hide();
            _trayIcon.ShowBalloonTip(
                3000, "Sisbackup Server",
                "Server tetap berjalan di background.\nKlik ikon tray untuk membuka.",
                System.Windows.Forms.ToolTipIcon.Info);
        }
    }

    protected override void OnClosed(EventArgs e)
    {
        _serverManager.Dispose();
        _trayIcon?.Dispose();
        base.OnClosed(e);
    }
}
