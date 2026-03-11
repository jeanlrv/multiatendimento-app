using System.Drawing;
using System.Drawing.Drawing2D;

namespace KBAgent;

public class SettingsForm : Form
{
    private readonly AgentConfig _config;

    // Inputs
    private TextBox txtUploadUrl = null!;
    private TextBox txtFolder = null!;
    private TextBox txtPattern = null!;
    private ComboBox cmbMode = null!;
    private NumericUpDown numInterval = null!;
    private TextBox txtDailyTime = null!;
    private CheckBox chkStartup = null!;
    private CheckBox chkUploadOnStart = null!;
    private Label lblTestStatus = null!;

    public AgentConfig ResultConfig { get; private set; } = null!;

    public SettingsForm(AgentConfig config)
    {
        _config = config;
        BuildUI();
        LoadFromConfig(config);
    }

    private void BuildUI()
    {
        Text = "KBAgent — Configurações";
        Size = new Size(620, 720);
        MinimumSize = new Size(580, 600);
        MaximumSize = new Size(800, 900);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9f);
        BackColor = Color.FromArgb(248, 248, 252);

        // ── Footer fixo com botões (DockStyle.Bottom) ─────────────────────────
        var footer = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 54,
            BackColor = Color.FromArgb(235, 235, 242),
            Padding = new Padding(14, 0, 14, 0),
        };

        var btnCancel = new Button
        {
            Text = "Cancelar",
            Size = new Size(110, 34),
            Dock = DockStyle.Right,
            FlatStyle = FlatStyle.Flat,
            Cursor = Cursors.Hand,
            Margin = new Padding(0, 10, 0, 10),
        };
        btnCancel.FlatAppearance.BorderColor = Color.FromArgb(180, 180, 190);
        btnCancel.Click += (_, __) => { DialogResult = DialogResult.Cancel; Close(); };

        var btnSave = new Button
        {
            Text = "Salvar e Aplicar",
            Size = new Size(140, 34),
            Dock = DockStyle.Right,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(70, 110, 220),
            ForeColor = Color.White,
            Cursor = Cursors.Hand,
            Margin = new Padding(0, 10, 8, 10),
        };
        btnSave.FlatAppearance.BorderSize = 0;
        btnSave.Click += OnSave;

        footer.Controls.Add(btnCancel);
        footer.Controls.Add(btnSave);
        Controls.Add(footer);

        // ── Painel de conteúdo rolável (DockStyle.Fill) ───────────────────────
        var scroll = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            Padding = new Padding(18, 14, 18, 10),
            BackColor = Color.FromArgb(248, 248, 252),
        };
        Controls.Add(scroll);

        int contentW = 560;

        var content = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoSize = true,
            Width = contentW,
        };
        scroll.Controls.Add(content);
        // Garante margem esquerda visível (o Padding do scroll não posiciona automaticamente)
        content.Location = new Point(18, 12);

        // ─── Helpers ──────────────────────────────────────────────────────────

        void AddSection(string title)
        {
            var sep = new Panel
            {
                Width = contentW,
                Height = 1,
                BackColor = Color.FromArgb(210, 210, 225),
                Margin = new Padding(0, 10, 0, 6),
            };
            content.Controls.Add(sep);

            var lbl = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 8f, FontStyle.Bold),
                ForeColor = Color.FromArgb(70, 90, 190),
                AutoSize = false,
                Width = contentW,
                Height = 20,
                Padding = new Padding(0),
                Margin = new Padding(0, 0, 0, 6),
            };
            content.Controls.Add(lbl);
        }

        Label MakeLabel(string text, int height = 18)
        {
            return new Label
            {
                Text = text,
                AutoSize = false,
                Width = contentW,
                Height = height,
                ForeColor = Color.FromArgb(60, 60, 70),
                Margin = new Padding(0, 2, 0, 2),
            };
        }

        TextBox MakeInput(int height = 28)
        {
            return new TextBox
            {
                Width = contentW,
                Height = height,
                Margin = new Padding(0, 0, 0, 8),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
            };
        }

        // ─── Secção KB ────────────────────────────────────────────────────────

        // Cabeçalho sem separador no topo
        var headerLbl = new Label
        {
            Text = "BASE DE CONHECIMENTO",
            Font = new Font("Segoe UI", 8f, FontStyle.Bold),
            ForeColor = Color.FromArgb(70, 90, 190),
            AutoSize = false,
            Width = contentW,
            Height = 20,
            Margin = new Padding(0, 0, 0, 6),
        };
        content.Controls.Add(headerLbl);

        content.Controls.Add(MakeLabel("URL de Upload  (copie diretamente do painel da Base de Conhecimento)", 18));

        var urlHint = new Label
        {
            Text = "Formato: https://seu-backend.com/api/ai/knowledge/webhook/kwh_.../upload",
            AutoSize = false,
            Width = contentW,
            Height = 16,
            ForeColor = Color.FromArgb(140, 140, 160),
            Font = new Font("Segoe UI", 7.5f),
            Margin = new Padding(0, 0, 0, 3),
        };
        content.Controls.Add(urlHint);

        txtUploadUrl = MakeInput(28);
        content.Controls.Add(txtUploadUrl);

        // Botão Testar Conexão
        var testRow = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = false,
            Width = contentW,
            Height = 36,
            Margin = new Padding(0, 0, 0, 8),
        };
        var btnTest = new Button
        {
            Text = "Testar Conexão",
            Width = 140,
            Height = 30,
            FlatStyle = FlatStyle.Flat,
            Cursor = Cursors.Hand,
        };
        btnTest.FlatAppearance.BorderColor = Color.FromArgb(100, 120, 210);
        btnTest.ForeColor = Color.FromArgb(70, 90, 190);
        btnTest.Click += async (_, __) => await OnTestConnection(btnTest);

        lblTestStatus = new Label
        {
            AutoSize = true,
            Margin = new Padding(10, 7, 0, 0),
            Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
        };
        testRow.Controls.Add(btnTest);
        testRow.Controls.Add(lblTestStatus);
        content.Controls.Add(testRow);

        // ─── Secção Arquivos ──────────────────────────────────────────────────
        AddSection("PASTA E ARQUIVOS");

        content.Controls.Add(MakeLabel("Pasta monitorada  (novos arquivos são detectados automaticamente em ~2s)", 18));
        var folderRow = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = false,
            Width = contentW,
            Height = 30,
            Margin = new Padding(0, 0, 0, 8),
        };
        txtFolder = new TextBox { Width = 440, Height = 28, BackColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
        var btnBrowse = new Button
        {
            Text = "Procurar...",
            Width = 100,
            Height = 28,
            FlatStyle = FlatStyle.Flat,
            Cursor = Cursors.Hand,
            Margin = new Padding(6, 0, 0, 0),
        };
        btnBrowse.FlatAppearance.BorderColor = Color.FromArgb(180, 180, 195);
        btnBrowse.Click += (_, __) =>
        {
            using var dlg = new FolderBrowserDialog { SelectedPath = txtFolder.Text, Description = "Selecione a pasta do ERP" };
            if (dlg.ShowDialog() == DialogResult.OK) txtFolder.Text = dlg.SelectedPath;
        };
        folderRow.Controls.Add(txtFolder);
        folderRow.Controls.Add(btnBrowse);
        content.Controls.Add(folderRow);

        content.Controls.Add(MakeLabel("Filtro de extensões  (separados por  ; )", 18));
        txtPattern = MakeInput();
        content.Controls.Add(txtPattern);

        // ─── Secção Agendamento ───────────────────────────────────────────────
        AddSection("AGENDAMENTO ADICIONAL");

        var note1 = new Label
        {
            Text = "O FileSystemWatcher está SEMPRE ativo — detecta e envia automaticamente em ~2s após salvar.",
            AutoSize = false,
            Width = contentW,
            Height = 20,
            ForeColor = Color.FromArgb(60, 140, 60),
            Font = new Font("Segoe UI", 8f, FontStyle.Bold),
            Margin = new Padding(0, 0, 0, 2),
        };
        content.Controls.Add(note1);

        content.Controls.Add(MakeLabel("Agendamento adicional (re-sync de segurança — opcional):", 18));

        cmbMode = new ComboBox
        {
            Width = contentW,
            Height = 26,
            DropDownStyle = ComboBoxStyle.DropDownList,
            Margin = new Padding(0, 0, 0, 6),
            BackColor = Color.White,
        };
        cmbMode.Items.AddRange(new object[]
        {
            "Somente ao detectar mudança na pasta  (recomendado)",
            "A cada intervalo fixo  (+ detecção automática)",
            "Diário em horário fixo  (+ detecção automática)",
            "Intervalo fixo + Diário  (+ detecção automática)",
        });
        cmbMode.SelectedIndex = 0;
        cmbMode.SelectedIndexChanged += (_, __) => UpdateScheduleControls();
        content.Controls.Add(cmbMode);

        var schedRow = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = false,
            Width = contentW,
            Height = 32,
            Margin = new Padding(0, 0, 0, 8),
        };
        schedRow.Controls.Add(new Label { Text = "Intervalo (min):", AutoSize = true, Margin = new Padding(0, 7, 6, 0) });
        numInterval = new NumericUpDown { Width = 70, Minimum = 5, Maximum = 1440, Value = 60, Margin = new Padding(0, 4, 20, 0), BackColor = Color.White };
        schedRow.Controls.Add(numInterval);
        schedRow.Controls.Add(new Label { Text = "Horário diário (HH:mm):", AutoSize = true, Margin = new Padding(0, 7, 6, 0) });
        txtDailyTime = new TextBox { Width = 65, Text = "18:00", BackColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
        schedRow.Controls.Add(txtDailyTime);
        content.Controls.Add(schedRow);

        // ─── Secção Opções ────────────────────────────────────────────────────
        AddSection("OPÇÕES DE INICIALIZAÇÃO");

        chkUploadOnStart = new CheckBox
        {
            Text = "Enviar todos os arquivos da pasta ao iniciar o agente",
            AutoSize = false,
            Width = contentW,
            Height = 24,
            Checked = true,
            Margin = new Padding(0, 0, 0, 4),
        };
        content.Controls.Add(chkUploadOnStart);

        chkStartup = new CheckBox
        {
            Text = "Iniciar automaticamente com o Windows",
            AutoSize = false,
            Width = contentW,
            Height = 24,
            Margin = new Padding(0, 0, 0, 2),
        };
        content.Controls.Add(chkStartup);

        var startupNote = new Label
        {
            Text = "(adiciona entrada no registro HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run)",
            AutoSize = false,
            Width = contentW,
            Height = 16,
            ForeColor = Color.FromArgb(150, 150, 165),
            Font = new Font("Segoe UI", 7.5f),
            Margin = new Padding(20, 0, 0, 8),
        };
        content.Controls.Add(startupNote);

        var infoPanel = new Panel
        {
            Width = contentW,
            Height = 38,
            BackColor = Color.FromArgb(230, 235, 255),
            Margin = new Padding(0, 4, 0, 8),
        };
        var infoLbl = new Label
        {
            Text = "ℹ  O agente roda na bandeja do sistema (system tray), não como serviço do Windows.",
            AutoSize = false,
            Width = contentW - 16,
            Height = 38,
            ForeColor = Color.FromArgb(70, 90, 170),
            Font = new Font("Segoe UI", 8f),
            Padding = new Padding(8, 8, 8, 8),
            Location = new Point(8, 0),
        };
        infoPanel.Controls.Add(infoLbl);
        content.Controls.Add(infoPanel);

        UpdateScheduleControls();
    }

    private void UpdateScheduleControls()
    {
        var mode = GetSelectedMode();
        numInterval.Enabled = mode is "interval" or "both";
        txtDailyTime.Enabled = mode is "daily" or "both";
    }

    private string GetSelectedMode() => cmbMode.SelectedIndex switch
    {
        1 => "interval",
        2 => "daily",
        3 => "both",
        _ => "onchange",
    };

    private void LoadFromConfig(AgentConfig cfg)
    {
        txtUploadUrl.Text = cfg.UploadUrl;
        txtFolder.Text = cfg.WatchFolder;
        txtPattern.Text = cfg.FilePattern;
        numInterval.Value = Math.Max(5, Math.Min(1440, cfg.Schedule.IntervalMinutes));
        txtDailyTime.Text = cfg.Schedule.DailyTime;
        chkStartup.Checked = cfg.StartWithWindows;
        chkUploadOnStart.Checked = cfg.UploadOnStartup;
        cmbMode.SelectedIndex = cfg.Schedule.Mode switch
        {
            "interval" => 1,
            "daily"    => 2,
            "both"     => 3,
            _          => 0,
        };
        UpdateScheduleControls();
    }

    private void OnSave(object? sender, EventArgs e)
    {
        var url = txtUploadUrl.Text.Trim();
        if (string.IsNullOrWhiteSpace(url))
        {
            MessageBox.Show("Preencha a URL de Upload.\n\nCopie a URL do painel da Base de Conhecimento → Integração Local.",
                "Validação", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtUploadUrl.Focus();
            return;
        }

        if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            MessageBox.Show("URL inválida. Deve começar com https://\n\nExemplo: https://seu-backend.com/api/ai/knowledge/webhook/kwh_.../upload",
                "Validação", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtUploadUrl.Focus();
            return;
        }

        // Garante que termina com /upload
        if (!url.EndsWith("/upload", StringComparison.OrdinalIgnoreCase))
            url = url.TrimEnd('/') + "/upload";

        ResultConfig = new AgentConfig
        {
            UploadUrl        = url,
            WatchFolder      = txtFolder.Text.Trim(),
            FilePattern      = string.IsNullOrWhiteSpace(txtPattern.Text)
                                 ? _config.FilePattern
                                 : txtPattern.Text.Trim(),
            DebounceMs       = _config.DebounceMs,
            RetryAttempts    = _config.RetryAttempts,
            RetryDelaySeconds = _config.RetryDelaySeconds,
            UploadOnStartup  = chkUploadOnStart.Checked,
            StartWithWindows = chkStartup.Checked,
            Schedule = new ScheduleConfig
            {
                Mode            = GetSelectedMode(),
                IntervalMinutes = (int)numInterval.Value,
                DailyTime       = txtDailyTime.Text.Trim(),
            },
        };

        ConfigManager.Save(ResultConfig);
        ConfigManager.SetStartWithWindows(ResultConfig.StartWithWindows);

        DialogResult = DialogResult.OK;
        Close();
    }

    private async Task OnTestConnection(Button btn)
    {
        var url = txtUploadUrl.Text.Trim();
        if (string.IsNullOrWhiteSpace(url))
        {
            lblTestStatus.Text = "⚠  Preencha a URL de Upload primeiro.";
            lblTestStatus.ForeColor = Color.DarkOrange;
            return;
        }

        // Normaliza URL para teste
        if (!url.EndsWith("/upload", StringComparison.OrdinalIgnoreCase))
            url = url.TrimEnd('/') + "/upload";

        btn.Enabled = false;
        lblTestStatus.Text = "Testando...";
        lblTestStatus.ForeColor = Color.Gray;

        var testCfg = new AgentConfig
        {
            UploadUrl   = url,
            WatchFolder = ".",
        };

        using var svc = new SyncService(testCfg);
        var ok = await svc.TestConnectionAsync();

        lblTestStatus.Text      = ok ? "✓  Conexão OK" : "✕  Falha — verifique a URL";
        lblTestStatus.ForeColor = ok ? Color.FromArgb(40, 140, 40) : Color.Crimson;
        btn.Enabled = true;
    }
}
