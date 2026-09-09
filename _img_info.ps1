Add-Type -AssemblyName System.Drawing
$w = [System.Drawing.Image]::FromFile((Resolve-Path 'assets/logos/DIILZO-LOGO-WHITE.png'))
Write-Host "White: $($w.Width)x$($w.Height) ratio=$([math]::Round($w.Width / $w.Height, 2))"
$w.Dispose()
$c = [System.Drawing.Image]::FromFile((Resolve-Path 'assets/logos/DIILZO-LOGO-COLOR.png'))
Write-Host "Color: $($c.Width)x$($c.Height) ratio=$([math]::Round($c.Width / $c.Height, 2))"
$c.Dispose()
