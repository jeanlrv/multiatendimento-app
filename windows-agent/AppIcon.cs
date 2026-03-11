using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;

namespace KBAgent;

/// <summary>
/// Gera um ícone customizado em runtime usando GDI+ (sem depender de arquivo .ico externo).
/// Usado para o NotifyIcon e as janelas do app.
/// </summary>
internal static class AppIcon
{
    private static Icon? _cached16;
    private static Icon? _cached32;

    public static Icon Get16() => _cached16 ??= Create(16);
    public static Icon Get32() => _cached32 ??= Create(32);

    private static Icon Create(int size)
    {
        using var bmp = new Bitmap(size, size);
        using var g = Graphics.FromImage(bmp);

        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        g.Clear(Color.Transparent);

        // Fundo: círculo azul
        var margin = size > 16 ? 1 : 0;
        var rect = new Rectangle(margin, margin, size - margin * 2 - 1, size - margin * 2 - 1);
        using var bgBrush = new SolidBrush(Color.FromArgb(255, 74, 120, 220));
        g.FillEllipse(bgBrush, rect);

        // Letra "K" no centro
        float fontSize = size * 0.42f;
        using var font = new Font("Segoe UI", fontSize, FontStyle.Bold, GraphicsUnit.Pixel);
        using var textBrush = new SolidBrush(Color.White);

        var text = "K";
        var sf = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center,
        };
        g.DrawString(text, font, textBrush, new RectangleF(0, 0, size, size), sf);

        // Ponto pequeno no canto inferior direito (símbolo de upload/sync)
        if (size >= 24)
        {
            var dotSize = size / 7;
            var dotX = size - dotSize - margin - 1;
            var dotY = size - dotSize - margin - 1;
            using var dotBrush = new SolidBrush(Color.FromArgb(180, 255, 200, 60));
            g.FillEllipse(dotBrush, dotX, dotY, dotSize, dotSize);
        }

        var hIcon = bmp.GetHicon();
        return Icon.FromHandle(hIcon);
    }
}
