using System.Drawing;

namespace KBAgent;

public class SettingsForm : Form
{
    private readonly AgentConfig _config;

    // Inputs
    private TextBox txtUrl = null!;
    private TextBox txtApiKey = null!;
    private CheckBox chkShowKey = null!;
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
        Size = new Size(540, 600);
        MinimumSize = new Size(540, 500);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9f);

        // ── Footer fixo com botões (DockStyle.Bottom) ─────────────────────
        var footer = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 50,
            BackColor = Color.FromArgb(240, 240, 245),
            Padding = new Padding(12, 8, 12, 8),
        };

        var btnCancel = new Button
        {
            Text = "Cancelar",
            Width = 100,
            Height = 34,
            Dock = DockStyle.Right,
            FlatStyle = FlatStyle.Flat,
        };
        btnCancel.Click += (_, __) => { DialogResult = DialogResult.Cancel; Close(); };

        var btnSave = new Button
        {
            Text = "Salvar e Aplicar",
            Width = 130,
            Height = 34,
            Dock = DockStyle.Right,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(70, 110, 220),
            ForeColor = Color.White,
        };
        btnSave.FlatAppearance.BorderSize = 0;
        btnSave.Click += OnSave;

        footer.Controls.Add(btnCancel);
        footer.Controls.Add(btnSave);
        Controls.Add(footer);

        // ── Painel de conteúdo rolável (DockStyle.Fill) ───────────────────
        var scroll = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            Padding = new Padding(16, 12, 16, 8),
        };
        Controls.Add(scroll);

        // ── Conteúdo dentro do painel rolável ─────────────────────────────
        var content = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoSize = true,
            Width = 490,
        };
        scroll.Controls.Add(content);

        void AddSection(string title)
        {
            var lbl = new Label
            {
                Text = title,
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(80, 80, 180),
                AutoSize = false,
                Width = 490,
                Height = 22,
                Padding = new Padding(0, 6, 0, 0),
                Margin = new Padding(0, 4, 0, 0),
            };
            content.Controls.Add(lbl);
        }

        Label MakeLabel(string text)
        {
            return new Label
            {
                Text = text,
                AutoSize = false,
                Width = 490,
                Height = 18,
                ForeColor = Color.FromArgb(50, 50, 50),
                Margin = new Padding(0, 2, 0, 0),
            };
        }

        TextBox MakeInput(bool isPassword = false)
        {
            return new TextBox
            {
                Width = 490,
                Height = 26,
                UseSystemPasswordChar = isPassword,
                Margin = new Padding(0, 0, 0, 6),
            };
        }

        // ─── Secção KB ────────────────────────────────────────────────────
        AddSection("BASE DE CONHECIMENTO");

        content.Controls.Add(MakeLabel("URL Base do Webhook  (ex: https://seu-backend.com/api/ai/knowledge/webhook)"));
        txtUrl = MakeInput();
        content.Controls.Add(txtUrl);

        content.Controls.Add(MakeLabel("API Key  (kwh_...)"));

        var keyRow = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = false,
            Width = 490,
            Height = 28,
            Margin = new Padding(0, 0, 0, 2),
        };
        txtApiKey = new TextBox { Width = 350, Height = 26, UseSystemPasswordChar = true };
        chkShowKey = new CheckBox { Text = "Mostrar", AutoSize = true, Margin = new Padding(6, 4, 0, 0) };
        chkShowKey.CheckedChanged += (_, __) => txtApiKey.UseSystemPasswordChar = !chkShowKey.Checked;
        keyRow.Controls.Add(txtApiKey);
        keyRow.Controls.Add(chkShowKey);
        content.Controls.Add(keyRow);

        // Botão Testar Conexão
        var testRow = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = false,
            Width = 490,
            Height = 34,
            Margin = new Padding(0, 2, 0, 8),
        };
        var btnTest = new Button
        {
            Text = "Testar Conexão",
            Width = 130,
            Height = 28,
            FlatStyle = FlatStyle.Flat,
        };
        btnTest.FlatAppearance.BorderColor = Color.FromArgb(100, 100, 200);
        btnTest.ForeColor = Color.FromArgb(80, 80, 180);
        btnTest.Click += async (_, __) => await OnTestConnection(btnTest);

        lblTestStatus = new Label { AutoSize = true, Margin = new Padding(8, 7, 0, 0), Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
        testRow.Controls.Add(btnTest);
        testRow.Controls.Add(lblTestStatus);
        content.Controls.Add(testRow);

        // ─── Secção Arquivos ──────────────────────────────────────────────
        AddSection("PASTA E ARQUIVOS");

        content.Controls.Add(MakeLabel("Pasta monitorada  (o agente detecta automaticamente novos arquivos)"));
        var folderRow = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = false,
            Width = 490,
            Height = 28,
            Margin = new Padding(0, 0, 0, 6),
        };
        txtFolder = new TextBox { Width = 370, Height = 26 };
        var btnBrowse = new Button { Text = "Procurar...", Width = 90, Height = 26, FlatStyle = FlatStyle.Flat, Margin = new Padding(4, 0, 0, 0) };
        btnBrowse.Click += (_, __) =>
        {
            using var dlg = new FolderBrowserDialog { SelectedPath = txtFolder.Text };
            if (dlg.ShowDialog() == DialogResult.OK) txtFolder.Text = dlg.SelectedPath;
        };
        folderRow.Controls.Add(txtFolder);
        folderRow.Controls.Add(btnBrowse);
        content.Controls.Add(folderRow);

        content.Controls.Add(MakeLabel("Filtro de extensões  (separados por  ;)"));
        txtPattern = MakeInput();
        content.Controls.Add(txtPattern);

        // ─── Secção Agendamento ───────────────────────────────────────────
        AddSection("AGENDAMENTO ADICIONAL");
        content.Controls.Add(MakeLabel("O monitoramento de mudanças na pasta é SEMPRE ativo (upload em ~2s após salvar o arquivo)."));
        content.Controls.Add(MakeLabel("Agendamento adicional (re-sync de segurança — opcional):"));

        cmbMode = new ComboBox
        {
            Width = 490,
            Height = 26,
            DropDownStyle = ComboBoxStyle.DropDownList,
            Margin = new Padding(0, 0, 0, 4),
        };
        cmbMode.Items.AddRange(new object[]
        {
            "Somente ao detectar mudança na pasta (recomendado)",
            "A cada intervalo fixo (+ detecção automática)",
            "Diário em horário fixo  (+ detecção automática)",
            "Intervalo + Detecção automática",
        });
        cmbMode.SelectedIndex = 0;
        cmbMode.SelectedIndexChanged += (_, __) => UpdateScheduleControls();
        content.Controls.Add(cmbMode);

        var schedRow = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            AutoSize = false,
            Width = 490,
            Height = 30,
            Margin = new Padding(0, 0, 0, 6),
        };
        schedRow.Controls.Add(new Label { Text = "Intervalo (min):", AutoSize = true, Margin = new Padding(0, 6, 4, 0) });
        numInterval = new NumericUpDown { Width = 65, Minimum = 5, Maximum = 1440, Value = 60, Margin = new Padding(0, 3, 16, 0) };
        schedRow.Controls.Add(numInterval);
        schedRow.Controls.Add(new Label { Text = "Horário diário (HH:mm):", AutoSize = true, Margin = new Padding(0, 6, 4, 0) });
        txtDailyTime = new TextBox { Width = 60, Text = "18:00" };
        schedRow.Controls.Add(txtDailyTime);
        content.Controls.Add(schedRow);

        // ─── Secção Opções ────────────────────────────────────────────────
        AddSection("OPÇÕES DE INICIALIZAÇÃO");

        chkUploadOnStart = new CheckBox
        {
            Text = "Enviar todos os arquivos da pasta ao iniciar o agente",
            AutoSize = false,
            Width = 490,
            Height = 22,
            Checked = true,
            Margin = new Padding(0, 0, 0, 4),
        };
        content.Controls.Add(chkUploadOnStart);

        chkStartup = new CheckBox
        {
            Text = "Iniciar automaticamente com o Windows  (adiciona entrada no registro HKCU)",
            AutoSize = false,
            Width = 490,
            Height = 22,
            Margin = new Padding(0, 0, 0, 4),
        };
        content.Controls.Add(chkStartup);

        var infoLbl = new Label
        {
            Text = "ℹ  O agente roda na bandeja do sistema (system tray), não como serviço do Windows.",
            AutoSize = false,
            Width = 490,
            Height = 32,
            ForeColor = Color.FromArgb(100, 100, 130),
            Font = new Font("Segoe UI", 8f),
            Margin = new Padding(0, 4, 0, 0),
        };
        content.Controls.Add(infoLbl);

        UpdateScheduleControls();
    }

    private void UpdateScheduleControls()
    {
        var mode = GetSelectedMode();
        numInterval.Enabled = mode is "interval" or "both";
        txtDailyTime.Enabled = mode is "daily";
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
        txtUrl.Text = cfg.WebhookUrl;
        txtApiKey.Text = cfg.ApiKey;
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
        if (string.IsNullOrWhiteSpace(txtUrl.Text))
        {
            MessageBox.Show("Preencha a URL Base do Webhook.", "Validação", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtUrl.Focus();
            return;
        }
        if (string.IsNullOrWhiteSpace(txtApiKey.Text))
        {
            MessageBox.Show("Preencha a API Key.", "Validação", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            txtApiKey.Focus();
            return;
        }

        ResultConfig = new AgentConfig
        {
            WebhookUrl      = txtUrl.Text.Trim().TrimEnd('/'),
            ApiKey          = txtApiKey.Text.Trim(),
            WatchFolder     = txtFolder.Text.Trim(),
            FilePattern     = string.IsNullOrWhiteSpace(txtPattern.Text)
                                ? _config.FilePattern
                                : txtPattern.Text.Trim(),
            DebounceMs      = _config.DebounceMs,
            RetryAttempts   = _config.RetryAttempts,
            RetryDelaySeconds = _config.RetryDelaySeconds,
            UploadOnStartup = chkUploadOnStart.Checked,
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
        if (string.IsNullOrWhiteSpace(txtUrl.Text) || string.IsNullOrWhiteSpace(txtApiKey.Text))
        {
            lblTestStatus.Text = "⚠  Preencha URL e API Key primeiro.";
            lblTestStatus.ForeColor = Color.DarkOrange;
            return;
        }

        btn.Enabled = false;
        lblTestStatus.Text = "Testando...";
        lblTestStatus.ForeColor = Color.Gray;

        var testCfg = new AgentConfig
        {
            WebhookUrl  = txtUrl.Text.Trim().TrimEnd('/'),
            ApiKey      = txtApiKey.Text.Trim(),
            WatchFolder = ".",
        };

        using var svc = new SyncService(testCfg);
        var ok = await svc.TestConnectionAsync();

        lblTestStatus.Text      = ok ? "✓  Conexão OK" : "✕  Falha — verifique URL e API Key";
        lblTestStatus.ForeColor = ok ? Color.Green : Color.Red;
        btn.Enabled = true;
    }
}
