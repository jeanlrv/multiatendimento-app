using System.Drawing;

namespace KBAgent;

public class LogForm : Form
{
    private readonly ListBox _listBox;

    public LogForm()
    {
        Text = "KBAgent — Log de Atividade";
        Size = new Size(640, 400);
        StartPosition = FormStartPosition.CenterScreen;
        Font = new Font("Consolas", 8.5f);

        _listBox = new ListBox
        {
            Dock = DockStyle.Fill,
            HorizontalScrollbar = true,
            IntegralHeight = false,
        };
        Controls.Add(_listBox);

        var btnClear = new Button { Text = "Limpar", Dock = DockStyle.Bottom, Height = 28, FlatStyle = FlatStyle.Flat };
        btnClear.Click += (_, __) => _listBox.Items.Clear();
        Controls.Add(btnClear);
    }

    public void AppendLog(string message)
    {
        if (InvokeRequired)
        {
            Invoke(() => AppendLog(message));
            return;
        }
        _listBox.Items.Insert(0, message); // mais recente no topo
        if (_listBox.Items.Count > 500)
            _listBox.Items.RemoveAt(_listBox.Items.Count - 1);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // Minimiza em vez de fechar
        if (e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            Hide();
        }
    }
}
