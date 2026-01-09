# Batch Upload Images to Cloudinary (PowerShell)
# 
# Usage:
#   .\cloudinary-upload.ps1 -ImageFolder "./images" -CloudName "my_cloud" -Preset "unsigned_preset"
# 
# Or with env vars:
#   $env:CLOUDINARY_CLOUD="my_cloud"
#   $env:CLOUDINARY_PRESET="unsigned_preset"
#   .\cloudinary-upload.ps1 -ImageFolder "./images"

param(
    [string]$ImageFolder = "./images",
    [string]$CloudName = $env:CLOUDINARY_CLOUD,
    [string]$Preset = $env:CLOUDINARY_PRESET
)

if (-not $CloudName) { $CloudName = "your_cloud_name" }
if (-not $Preset) { $Preset = "unsigned_preset" }

$SUPPORTED_FORMATS = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp")

if (-not (Test-Path $ImageFolder)) {
    Write-Host "❌ Folder not found: $ImageFolder" -ForegroundColor Red
    exit 1
}

if ($CloudName -eq "your_cloud_name") {
    Write-Host "❌ CLOUDINARY_CLOUD not set. Set `$env:CLOUDINARY_CLOUD or pass -CloudName." -ForegroundColor Red
    exit 1
}

Write-Host "🔍 Scanning for images in: $ImageFolder" -ForegroundColor Cyan
Write-Host "☁️  Using Cloudinary cloud: $CloudName`n" -ForegroundColor Cyan

$files = Get-ChildItem $ImageFolder -File | Where-Object { $SUPPORTED_FORMATS -contains $_.Extension.ToLower() }

if ($files.Count -eq 0) {
    Write-Host "⚠️  No image files found." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($files.Count) image(s).`n" -ForegroundColor Green

$results = @()

foreach ($file in $files) {
    try {
        Write-Host "  📤 Uploading: $($file.Name)..." -ForegroundColor Cyan
        
        $form = @{
            file           = (Get-Content $file.FullName -Raw)
            upload_preset  = $Preset
            folder         = "cactus-studio"
        }

        $uri = "https://api.cloudinary.com/v1_1/$CloudName/image/upload"
        
        # Use multipart form data
        $body = @()
        $body += "--boundary123`r`n"
        $body += "Content-Disposition: form-data; name=`"file`"; filename=`"$($file.Name)`"`r`n"
        $body += "Content-Type: image/$($file.Extension.TrimStart('.'))`r`n`r`n"
        $body += [System.IO.File]::ReadAllBytes($file.FullName)
        $body += "`r`n--boundary123`r`n"
        $body += "Content-Disposition: form-data; name=`"upload_preset`"`r`n`r`n"
        $body += $Preset
        $body += "`r`n--boundary123`r`n"
        $body += "Content-Disposition: form-data; name=`"folder`"`r`n`r`n"
        $body += "cactus-studio"
        $body += "`r`n--boundary123--`r`n"

        $response = Invoke-WebRequest -Uri $uri -Method Post -Body ([byte[]]$body) -ContentType "multipart/form-data; boundary=boundary123" -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json

        $optimized = $data.secure_url.Replace("/upload/", "/upload/w_500,q_auto,f_webp/")
        Write-Host "  ✅ Success: $optimized" -ForegroundColor Green
        
        $results += @{
            original_url = $data.secure_url
            optimized_url = $optimized
            public_id = $data.public_id
            filename = $file.Name
        }
    }
    catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host "`n✨ Upload complete! $($results.Count)/$($files.Count) succeeded.`n" -ForegroundColor Green

if ($results.Count -gt 0) {
    Write-Host "📋 URLs for data.json:`n" -ForegroundColor Cyan
    $results | ForEach-Object -Begin { $i = 0 } -Process {
        $i++
        $obj = @{
            id = $i
            name = [System.IO.Path]::GetFileNameWithoutExtension($_.filename)
            price_cents = 2500
            image_url = $_.optimized_url
            class = "Cactus"
        }
        Write-Host "  $i. $(($obj | ConvertTo-Json) -replace "`n", "`n     ")"
    }
}
