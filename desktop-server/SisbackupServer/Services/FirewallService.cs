using System.Diagnostics;

namespace SisbackupServer.Services;

/// <summary>
/// Manages Windows Firewall rules for Sisbackup Server
/// </summary>
public class FirewallService
{
    private const string RuleName = "Sisbackup Server (HTTP API)";
    private const string RuleNameTcp = "Sisbackup Server (TCP)";

    public bool IsFirewallRuleExists(int port)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = $"advfirewall firewall show rule name=\"{RuleName}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
            };
            var process = Process.Start(psi);
            process?.WaitForExit(3000);
            return process?.ExitCode == 0;
        }
        catch { return false; }
    }

    public bool AddFirewallRule(int port)
    {
        try
        {
            // Add inbound rule for TCP
            var psi = new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = $"advfirewall firewall add rule " +
                    $"name=\"{RuleNameTcp}\" " +
                    $"dir=in action=allow " +
                    $"protocol=TCP " +
                    $"localport={port} " +
                    $"profile=private,domain " +
                    $"description=\"Izinkan akses ke Sisbackup App Server dari jaringan lokal\"",
                Verb = "runas", // Elevate to admin
                UseShellExecute = true,
                CreateNoWindow = true,
            };

            var process = Process.Start(psi);
            process?.WaitForExit(5000);
            return process?.ExitCode == 0;
        }
        catch (UnauthorizedAccessException)
        {
            // Not running as admin — firewall rule not added
            // Server can still run but may not be accessible from other PCs
            return false;
        }
        catch { return false; }
    }

    public bool RemoveFirewallRule()
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "netsh",
                Arguments = $"advfirewall firewall delete rule name=\"{RuleNameTcp}\"",
                Verb = "runas",
                UseShellExecute = true,
                CreateNoWindow = true,
            };
            var process = Process.Start(psi);
            process?.WaitForExit(3000);
            return process?.ExitCode == 0;
        }
        catch { return false; }
    }
}
