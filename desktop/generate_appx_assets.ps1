Add-Type -AssemblyName System.Drawing

function Generate-AppxIcon {
    param (
        [string]$sourcePath,
        [string]$outputPath,
        [int]$width,
        [int]$height,
        [bool]$isWide = $false
    )
    $srcImg = [System.Drawing.Image]::FromFile($sourcePath)
    $destImg = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destImg)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    $g.Clear([System.Drawing.Color]::Transparent)
    
    if ($isWide) {
        $targetH = 120
        $aspect = $srcImg.Width / $srcImg.Height
        $targetW = [int]($targetH * $aspect)
        $posX = [int](($width - $targetW) / 2)
        $posY = [int](($height - $targetH) / 2)
        $g.DrawImage($srcImg, $posX, $posY, $targetW, $targetH)
    } else {
        $g.DrawImage($srcImg, 0, 0, $width, $height)
    }
    
    $destImg.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $destImg.Dispose()
    $srcImg.Dispose()
}

$sourceIcon = "c:\Users\BODDU_VAMSI\.gemini\antigravity\scratch\ChurchLyricsSystem\desktop\public\icon_1080.png"
$outputDir = "c:\Users\BODDU_VAMSI\.gemini\antigravity\scratch\ChurchLyricsSystem\desktop\build\appx"

if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Standard tiles
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.png" 44 44
Generate-AppxIcon $sourceIcon "$outputDir\Square71x71Logo.png" 71 71
Generate-AppxIcon $sourceIcon "$outputDir\Square150x150Logo.png" 150 150
Generate-AppxIcon $sourceIcon "$outputDir\Square310x310Logo.png" 310 310
Generate-AppxIcon $sourceIcon "$outputDir\StoreLogo.png" 50 50
Generate-AppxIcon $sourceIcon "$outputDir\BadgeLogo.png" 24 24
Generate-AppxIcon $sourceIcon "$outputDir\Wide310x150Logo.png" 310 150 -isWide $true

# TARGETSIZE TILES (Crucial for crisp Desktop and Taskbar icons in MSIX/AppX)
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.targetsize-16.png" 16 16
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.targetsize-24.png" 24 24
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.targetsize-32.png" 32 32
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.targetsize-48.png" 48 48
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.targetsize-256.png" 256 256

# TARGETSIZE UNPLATED TILES (Crucial for crisp Taskbar icons with transparent backgrounds)
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.altform-unplated_targetsize-16.png" 16 16
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.altform-unplated_targetsize-24.png" 24 24
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.altform-unplated_targetsize-32.png" 32 32
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.altform-unplated_targetsize-48.png" 48 48
Generate-AppxIcon $sourceIcon "$outputDir\Square44x44Logo.altform-unplated_targetsize-256.png" 256 256

Write-Output "Successfully generated ALL AppX tile assets, including high-res targetsize variants, in: $outputDir"
