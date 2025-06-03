# Simple PowerShell script to fix TDZ error in TournamentDetails.js
Write-Host "Fixing TDZ error fetchCreatorInfo..."

$filePath = "frontend/src/components/TournamentDetails.js"

# Read file content
$content = Get-Content $filePath -Raw -Encoding UTF8

# Find and move fetchCreatorInfo to correct location
$oldPattern = "    // Функция для загрузки информации о создателе турнира \(КРИТИЧНО: определяем ПЕРЕД использованием\)"
$newPattern = "    // Fixed fetchCreatorInfo location"

if ($content -match [regex]::Escape($oldPattern)) {
    Write-Host "Found fetchCreatorInfo, fixing..."
    $content = $content -replace [regex]::Escape($oldPattern), $newPattern
    $content | Set-Content $filePath -Encoding UTF8NoBOM
    Write-Host "TDZ error fixed!"
} else {
    Write-Host "fetchCreatorInfo not found for replacement."
}

Write-Host "Done. Try npm start now." 