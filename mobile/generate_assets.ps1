Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param (
        [string]$sourcePath,
        [string]$outputPath,
        [int]$width,
        [int]$height
    )
    $srcImg = [System.Drawing.Image]::FromFile($sourcePath)
    $destImg = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($destImg)
    
    $g.Clear([System.Drawing.Color]::FromArgb(255, 17, 24, 39)) # #111827 Dark BG
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    # Calculate aspect ratio to fit inside target size
    $aspect = $srcImg.Width / $srcImg.Height
    $targetAspect = $width / $height
    
    if ($aspect -gt $targetAspect) {
        $newW = $width
        $newH = [int]($width / $aspect)
    } else {
        $newH = $height
        $newW = [int]($height * $aspect)
    }
    
    $posX = [int](($width - $newW) / 2)
    $posY = [int](($height - $newH) / 2)
    
    $g.DrawImage($srcImg, $posX, $posY, $newW, $newH)
    
    $destImg.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g.Dispose()
    $destImg.Dispose()
    $srcImg.Dispose()
}

# Create 512x512 App Icon
$iconSource = "c:\Users\BODDU_VAMSI\AppData\Roaming\npm\node_modules\expo-cli\bin\expo.js" # dummy fallback
$realIcon = "c:\Users\BODDU_VAMSI\.gemini\antigravity\scratch\ChurchLyricsSystem\mobile\assets\icon.png"
$outIcon = "c:\Users\BODDU_VAMSI\.gemini\antigravity\scratch\ChurchLyricsSystem\mobile\assets\icon_512.png"
Resize-Image $realIcon $outIcon 512 512
Write-Output "Created 512x512 app icon at: $outIcon"

# Create 1024x500 Feature Graphic with centered logo (scaled to fit nicely, e.g. 350px tall)
$realLogo = "c:\Users\BODDU_VAMSI\.gemini\antigravity\scratch\ChurchLyricsSystem\mobile\assets\branding_logo.png"
if (-not (Test-Path $realLogo)) {
    $realLogo = "c:\Users\BODDU_VAMSI\.gemini\antigravity\scratch\ChurchLyricsSystem\mobile\assets\icon.png"
}
$outFeature = "c:\Users\BODDU_VAMSI\.gemini\antigravity\scratch\ChurchLyricsSystem\mobile\assets\feature_graphic.png"

$width = 1024
$height = 500
$srcImg = [System.Drawing.Image]::FromFile($realLogo)
$destImg = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($destImg)

# Create a beautiful dark gradient background
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($width, $height)),
    [System.Drawing.Color]::FromArgb(255, 11, 15, 25), # #0b0f19
    [System.Drawing.Color]::FromArgb(255, 31, 41, 55)  # #1f2937
)
$g.FillRectangle($brush, 0, 0, $width, $height)

# Center the logo (make it 250px tall inside the 500px height)
$targetH = 250
$aspect = $srcImg.Width / $srcImg.Height
$targetW = [int]($targetH * $aspect)

$posX = [int](($width - $targetW) / 2)
$posY = [int](($height - $targetH) / 2)

$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
$g.DrawImage($srcImg, $posX, $posY, $targetW, $targetH)

$destImg.Save($outFeature, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$destImg.Dispose()
$srcImg.Dispose()
$brush.Dispose()

Write-Output "Created 1024x500 Feature Graphic at: $outFeature"
