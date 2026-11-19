# Recomprime as fotos de candidaturas (JPEG) para deixá-las leves no site.
# Mantém no máximo 161x225 px e grava com qualidade 72. Só mexe nas maiores que 12 KB.
# Uso (Windows PowerShell): powershell -ExecutionPolicy Bypass -File scripts\reduzir_fotos.ps1 data\fotos\2024
param([Parameter(Mandatory = $true)][string]$Pasta, [int]$Qualidade = 72, [int]$MaxW = 161, [int]$MaxH = 225)

Add-Type -AssemblyName System.Drawing
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Qualidade)

$antes = 0; $depois = 0; $n = 0
Get-ChildItem -Path $Pasta -Recurse -Filter *.jpg | Where-Object { $_.Length -gt 12000 } | ForEach-Object {
  $arq = $_.FullName
  $antes += $_.Length
  try {
    $bytes = [System.IO.File]::ReadAllBytes($arq)
    $ms = New-Object System.IO.MemoryStream (, $bytes)
    $img = [System.Drawing.Image]::FromStream($ms)
    $s = [Math]::Min(1.0, [Math]::Min($MaxW / $img.Width, $MaxH / $img.Height))
    $w = [int][Math]::Round($img.Width * $s); $h = [int][Math]::Round($img.Height * $s)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose(); $img.Dispose(); $ms.Dispose()
    $bmp.Save($arq, $codec, $params)
    $bmp.Dispose()
    $depois += (Get-Item $arq).Length
    $n++
  } catch { Write-Output "falhou: $arq ($($_.Exception.Message))" }
}
"{0} fotos: {1:N1} MB -> {2:N1} MB" -f $n, ($antes / 1MB), ($depois / 1MB)
