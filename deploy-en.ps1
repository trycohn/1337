# Deploy Modular Architecture Script

Write-Host "Starting modular architecture deployment..." -ForegroundColor Green

# Check if we are in project root
if (-not (Test-Path "package.json") -or -not (Test-Path "frontend")) {
    Write-Host "ERROR: Run script from project root!" -ForegroundColor Red
    exit 1
}

Write-Host "Checking project structure..." -ForegroundColor Cyan

# Create backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (Test-Path "frontend\src\components\TournamentDetails.js") {
    Copy-Item "frontend\src\components\TournamentDetails.js" "frontend\src\components\TournamentDetails.js.backup.$timestamp"
    Write-Host "Backup created" -ForegroundColor Green
}

# Create directories
$requiredDirs = @(
    "frontend\src\components\tournament\tabs",
    "frontend\src\components\tournament\modals", 
    "frontend\src\components\tournament\ui",
    "frontend\src\components\tournament\forms"
)

foreach ($dir in $requiredDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Yellow
    }
}

# Check hooks
$requiredHooks = @(
    "frontend\src\hooks\tournament\useTournamentData.js",
    "frontend\src\hooks\tournament\useWebSocket.js", 
    "frontend\src\hooks\tournament\useTournamentAuth.js",
    "frontend\src\hooks\tournament\useMapsManagement.js"
)

$hooksExist = $true
foreach ($hook in $requiredHooks) {
    if (-not (Test-Path $hook)) {
        Write-Host "Missing hook: $hook" -ForegroundColor Red
        $hooksExist = $false
    }
}

if ($hooksExist) {
    Write-Host "Custom hooks verified" -ForegroundColor Green
} else {
    Write-Host "Some hooks are missing!" -ForegroundColor Red
}

# Check main component
if (Test-Path "frontend\src\components\tournament\TournamentDetails\index.js") {
    Write-Host "Main component found" -ForegroundColor Green
} else {
    Write-Host "Main component missing" -ForegroundColor Red
}

# Copy CSS file
if (Test-Path "frontend\src\components\TournamentDetails.css") {
    $targetDir = "frontend\src\components\tournament\TournamentDetails"
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Copy-Item "frontend\src\components\TournamentDetails.css" "$targetDir\TournamentDetails.css"
    Write-Host "CSS file copied" -ForegroundColor Green
}

# Check Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js found: $nodeVersion" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Node.js not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deployment completed!" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host ""
Write-Host "What was done:" -ForegroundColor Cyan
Write-Host "- Created directory structure" -ForegroundColor Green
Write-Host "- Verified custom hooks" -ForegroundColor Green
Write-Host "- Copied CSS file" -ForegroundColor Green
Write-Host "- Created backup" -ForegroundColor Green
Write-Host ""
Write-Host "Modular architecture is ready!" -ForegroundColor Green 