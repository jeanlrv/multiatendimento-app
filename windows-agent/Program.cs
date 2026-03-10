using System.Drawing;

namespace KBAgent;

static class Program
{
    [STAThread]
    static void Main()
    {
        ApplicationConfiguration.Initialize();

        var config = ConfigManager.Load();
        var syncService = new SyncService(config);
        var logForm = new LogForm();

        syncService.OnLog += msg =>
        {
            logForm.AppendLog(msg);
            Console.WriteLine(msg);
        };

        // Iniciar monitoramento se configurado
        if (config.IsConfigured)
            syncService.Start();

        // Ícone da bandeja
        var trayMenu = new ContextMenuStrip();
        var lblStatus = new ToolStripMenuItem("● KBAgent") { Enabled = false, Font = new Font("Segoe UI", 9f, FontStyle.Bold) };
        trayMenu.Items.Add(lblStatus);
        trayMenu.Items.Add(new ToolStripSeparator());

        // Instancia o trayIcon antes dos handlers que o referenciam
        var trayIcon = new NotifyIcon
        {
            Text = "KBAgent — Upload Automático para KB",
            Icon = SystemIcons.Application,
            Visible = true,
            ContextMenuStrip = trayMenu,
        };

        trayMenu.Items.Add("Sincronizar Agora", null, async (_, __) =>
        {
            if (!config.IsConfigured)
            {
                MessageBox.Show("Configure o agente antes de sincronizar.", "KBAgent", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            syncService.OnLog?.Invoke($"[{DateTime.Now:HH:mm:ss}] 🔄 Sincronização manual iniciada");
            // Reenvia todos os arquivos da pasta
            if (!string.IsNullOrEmpty(config.WatchFolder))
            {
                var patterns = config.FilePattern.Split(';', StringSplitOptions.RemoveEmptyEntries);
                var files = patterns
                    .SelectMany(p => Directory.Exists(config.WatchFolder)
                        ? Directory.GetFiles(config.WatchFolder, p, SearchOption.AllDirectories)
                        : Array.Empty<string>())
                    .Distinct();
                foreach (var f in files)
                    await syncService.UploadWithRetryAsync(f);
            }
        });

        trayMenu.Items.Add("Configurações...", null, (_, __) =>
        {
            using var form = new SettingsForm(config);
            if (form.ShowDialog() == DialogResult.OK)
            {
                config = form.ResultConfig;
                syncService.UpdateConfig(config);
                UpdateTrayIcon(trayIcon, lblStatus, config.IsConfigured);
            }
        });

        trayMenu.Items.Add("Ver Log...", null, (_, __) => { logForm.Show(); logForm.BringToFront(); });

        trayMenu.Items.Add(new ToolStripSeparator());

        trayMenu.Items.Add("Sair", null, (_, __) =>
        {
            syncService.Stop();
            syncService.Dispose();
            trayIcon.Visible = false;
            trayIcon.Dispose();
            Application.Exit();
        });

        trayIcon.DoubleClick += (_, __) =>
        {
            using var form = new SettingsForm(config);
            if (form.ShowDialog() == DialogResult.OK)
            {
                config = form.ResultConfig;
                syncService.UpdateConfig(config);
                UpdateTrayIcon(trayIcon, lblStatus, config.IsConfigured);
            }
        };

        UpdateTrayIcon(trayIcon, lblStatus, config.IsConfigured);

        // Primeiro uso: abre configurações automaticamente se não configurado
        if (!config.IsConfigured)
        {
            using var form = new SettingsForm(config);
            if (form.ShowDialog() == DialogResult.OK)
            {
                config = form.ResultConfig;
                syncService.UpdateConfig(config);
                UpdateTrayIcon(trayIcon, lblStatus, config.IsConfigured);
            }
        }

        Application.Run();
    }

    private static void UpdateTrayIcon(NotifyIcon icon, ToolStripMenuItem label, bool isConfigured)
    {
        icon.Icon = isConfigured ? SystemIcons.Application : SystemIcons.Warning;
        label.Text = isConfigured ? "● KBAgent — Ativo" : "⚠ KBAgent — Não configurado";
    }
}
