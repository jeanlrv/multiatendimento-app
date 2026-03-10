using System.Drawing;

namespace KBAgent;

public class SettingsForm : Form
{
    private readonly AgentConfig _config;
    private TextBox txtUrl = null!;
    private TextBox txtApiKey = null!;
    private TextBox txtFolder = null!;
    private TextBox txtPattern = null!;
    private ComboBox cmbMode = null!;
    private NumericUpDown numInterval = null!;
    private TextBox txtDailyTime = null!;
    private CheckBox chkStartup = null!;
    private CheckBox chkUploadOnStart = null!;
    private Button btnTest = null!;
    private Label lblStatus = null!;
    private SyncService? _testService;

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
        Size = new Size(520, 560);
        MinimumSize = new Size(520, 560);
        MaximumSize = new Size(520, 560);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Segoe UI", 9f);

        var panel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(16) };
        Controls.Add(panel);

        int y = 12;
        int labelHeight = 20;
        int inputHeight = 28;
        int gap = 8;
        int sectionGap = 18;

        void AddSection(string title)
        {
            var sep = new Label { Text = title, Font = new Font("Segoe UI", 8f, FontStyle.Bold), ForeColor = Color.FromArgb(100, 100, 180), Left = 0, Top = y, Width = 460, Height = labelHeight };
            panel.Controls.Add(sep);
            y += labelHeight + 2;
        }

        void AddLabel(string text)
        {
            var lbl = new Label { Text = text, Left = 0, Top = y, Width = 460, Height = labelHeight, ForeColor = Color.FromArgb(60, 60, 60) };
            panel.Controls.Add(lbl);
            y += labelHeight + 2;
        }

        TextBox AddInput(bool password = false)
        {
            var tb = new TextBox { Left = 0, Top = y, Width = 460, Height = inputHeight, UseSystemPasswordChar = password };
            panel.Controls.Add(tb);
            y += inputHeight + gap;
            return tb;
        }

        // ── KB ──────────────────────────────────────────────────────────────
        AddSection("BASE DE CONHECIMENTO");
        AddLabel("URL Base do Webhook (ex: https://backend.url/api/ai/knowledge/webhook):");
        txtUrl = AddInput();

        AddLabel("API Key (kwh_...):");
        txtApiKey = AddInput(password: true);

        btnTest = new Button { Text = "Testar Conexão", Left = 0, Top = y, Width = 140, Height = 28, FlatStyle = FlatStyle.Flat };
        btnTest.FlatAppearance.BorderColor = Color.FromArgb(100, 100, 200);
        btnTest.ForeColor = Color.FromArgb(80, 80, 180);
        btnTest.Click += async (_, __) => await OnTestConnection();
        panel.Controls.Add(btnTest);

        lblStatus = new Label { Left = 150, Top = y + 5, Width = 310, Height = 20, Font = new Font("Segoe UI", 8.5f, FontStyle.Bold) };
        panel.Controls.Add(lblStatus);
        y += 36 + sectionGap;

        // ── Pasta ────────────────────────────────────────────────────────────
        AddSection("ARQUIVOS");
        AddLabel("Pasta monitorada:");
        var folderRow = new Panel { Left = 0, Top = y, Width = 460, Height = inputHeight };
        txtFolder = new TextBox { Dock = DockStyle.Fill, Padding = new Padding(0, 0, 90, 0) };
        var btnBrowse = new Button { Text = "Procurar...", Dock = DockStyle.Right, Width = 85, FlatStyle = FlatStyle.Flat };
        btnBrowse.Click += (_, __) =>
        {
            using var dlg = new FolderBrowserDialog { SelectedPath = txtFolder.Text };
            if (dlg.ShowDialog() == DialogResult.OK) txtFolder.Text = dlg.SelectedPath;
        };
        folderRow.Controls.Add(txtFolder);
        folderRow.Controls.Add(btnBrowse);
        panel.Controls.Add(folderRow);
        y += inputHeight + gap;

        AddLabel("Filtro de arquivos (separados por ;):");
        txtPattern = AddInput();

        y += sectionGap;

        // ── Agendamento ──────────────────────────────────────────────────────
        AddSection("AGENDAMENTO ADICIONAL (o monitoramento de mudanças é sempre ativo)");
        AddLabel("Modo:");
        cmbMode = new ComboBox { Left = 0, Top = y, Width = 250, DropDownStyle = ComboBoxStyle.DropDownList };
        cmbMode.Items.AddRange(new object[] { "Apenas ao detectar mudança (onchange)", "A cada intervalo (interval)", "Diário em horário fixo (daily)", "Mudança + Intervalo (both)" });
        cmbMode.SelectedIndex = 0;
        cmbMode.SelectedIndexChanged += (_, __) => UpdateScheduleVisibility();
        panel.Controls.Add(cmbMode);
        y += inputHeight + gap;

        var pnlSchedule = new FlowLayoutPanel { Left = 0, Top = y, Width = 460, Height = inputHeight + 4, FlowDirection = FlowDirection.LeftToRight, WrapContents = false };
        var lblInterval = new Label { Text = "Intervalo (min):", AutoSize = true, Margin = new Padding(0, 6, 4, 0) };
        numInterval = new NumericUpDown { Width = 60, Minimum = 5, Maximum = 1440, Value = 60, Margin = new Padding(0, 2, 16, 0) };
        var lblDaily = new Label { Text = "Horário (HH:mm):", AutoSize = true, Margin = new Padding(0, 6, 4, 0) };
        txtDailyTime = new TextBox { Width = 60, Text = "18:00" };
        pnlSchedule.Controls.AddRange(new Control[] { lblInterval, numInterval, lblDaily, txtDailyTime });
        panel.Controls.Add(pnlSchedule);
        y += inputHeight + sectionGap;

        // ── Opções ───────────────────────────────────────────────────────────
        AddSection("OPÇÕES");
        chkUploadOnStart = new CheckBox { Text = "Enviar arquivos existentes ao iniciar o agente", Left = 0, Top = y, Width = 460, Checked = true };
        panel.Controls.Add(chkUploadOnStart);
        y += 24;

        chkStartup = new CheckBox { Text = "Iniciar com o Windows (HKCU Run)", Left = 0, Top = y, Width = 460 };
        panel.Controls.Add(chkStartup);
        y += 24 + sectionGap;

        // ── Botões ───────────────────────────────────────────────────────────
        var btnSave = new Button { Text = "Salvar", Left = 280, Top = y, Width = 85, Height = 30, FlatStyle = FlatStyle.Flat, BackColor = Color.FromArgb(80, 120, 220), ForeColor = Color.White };
        btnSave.Click += OnSave;
        var btnCancel = new Button { Text = "Cancelar", Left = 375, Top = y, Width = 85, Height = 30, FlatStyle = FlatStyle.Flat };
        btnCancel.Click += (_, __) => { DialogResult = DialogResult.Cancel; Close(); };
        panel.Controls.Add(btnSave);
        panel.Controls.Add(btnCancel);

        UpdateScheduleVisibility();
    }

    private void UpdateScheduleVisibility()
    {
        var mode = GetSelectedMode();
        var showInterval = mode is "interval" or "both";
        var showDaily = mode is "daily";
        numInterval.Enabled = showInterval;
        txtDailyTime.Enabled = showDaily;
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
        numInterval.Value = cfg.Schedule.IntervalMinutes;
        txtDailyTime.Text = cfg.Schedule.DailyTime;
        chkStartup.Checked = cfg.StartWithWindows;
        chkUploadOnStart.Checked = cfg.UploadOnStartup;
        cmbMode.SelectedIndex = cfg.Schedule.Mode switch
        {
            "interval" => 1,
            "daily" => 2,
            "both" => 3,
            _ => 0,
        };
        UpdateScheduleVisibility();
    }

    private void OnSave(object? sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(txtUrl.Text) || string.IsNullOrWhiteSpace(txtApiKey.Text))
        {
            MessageBox.Show("URL e API Key são obrigatórios.", "Validação", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        ResultConfig = new AgentConfig
        {
            WebhookUrl = txtUrl.Text.Trim().TrimEnd('/'),
            ApiKey = txtApiKey.Text.Trim(),
            WatchFolder = txtFolder.Text.Trim(),
            FilePattern = txtPattern.Text.Trim(),
            DebounceMs = _config.DebounceMs,
            RetryAttempts = _config.RetryAttempts,
            RetryDelaySeconds = _config.RetryDelaySeconds,
            UploadOnStartup = chkUploadOnStart.Checked,
            StartWithWindows = chkStartup.Checked,
            Schedule = new ScheduleConfig
            {
                Mode = GetSelectedMode(),
                IntervalMinutes = (int)numInterval.Value,
                DailyTime = txtDailyTime.Text.Trim(),
            },
        };

        ConfigManager.Save(ResultConfig);
        ConfigManager.SetStartWithWindows(ResultConfig.StartWithWindows);

        DialogResult = DialogResult.OK;
        Close();
    }

    private async Task OnTestConnection()
    {
        btnTest.Enabled = false;
        lblStatus.Text = "Testando...";
        lblStatus.ForeColor = Color.Gray;

        var testCfg = new AgentConfig
        {
            WebhookUrl = txtUrl.Text.Trim().TrimEnd('/'),
            ApiKey = txtApiKey.Text.Trim(),
            WatchFolder = ".",
        };

        _testService ??= new SyncService(testCfg);
        _testService.UpdateConfig(testCfg);

        var ok = await _testService.TestConnectionAsync();

        lblStatus.Text = ok ? "✓ Conexão OK" : "✕ Falha na conexão";
        lblStatus.ForeColor = ok ? Color.Green : Color.Red;
        btnTest.Enabled = true;
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        _testService?.Dispose();
        base.OnFormClosed(e);
    }
}
