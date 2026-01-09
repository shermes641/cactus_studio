$rootPath = 'e:\_A_CACTUS'
$files = @()

# Get .ts files from root (non-recursive)
$rootFiles = Get-ChildItem -Path $rootPath -Filter '*.ts'
$files += $rootFiles

# Get .ts files from src directory
$srcFiles = Get-ChildItem -Path "$rootPath\src" -Filter '*.ts' -ErrorAction SilentlyContinue
$files += $srcFiles

foreach ($file in $files) {
    $content = Get-Content -Raw -Path $file.FullName
    # Remove lines that are diff headers or only contain '+'
    $lines = $content -split "`n"
    $newLines = @()
    foreach ($line in $lines) {
        if ($line -match '^(\+\+\+ |@@ |--- )') {
            # Skip diff header lines entirely
            continue
        } elseif ($line -match '^\+') {
            # Remove leading '+' from code lines
            $newLines += $line -replace '^\+', ''
        } else {
            # Keep other lines as-is
            $newLines += $line
        }
    }
    $newContent = $newLines -join "`n"
    Set-Content -Path $file.FullName -Value $newContent
    Write-Host "Processed: $($file.FullName)"
}
Write-Host "Done removing leading '+' from .ts files in root and src directories"
