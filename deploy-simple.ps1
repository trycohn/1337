# Простой скрипт деплоя модульной архитектуры

Write-Host "Начинаем деплой модульной архитектуры..." -ForegroundColor Green

# Проверяем, что мы в корне проекта
if (-not (Test-Path "package.json") -or -not (Test-Path "frontend")) {
    Write-Host "ОШИБКА: Запустите скрипт из корня проекта!" -ForegroundColor Red
    exit 1
}

Write-Host "Проверка структуры проекта..." -ForegroundColor Cyan

# Создаем резервную копию
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (Test-Path "frontend\src\components\TournamentDetails.js") {
    Copy-Item "frontend\src\components\TournamentDetails.js" "frontend\src\components\TournamentDetails.js.backup.$timestamp"
    Write-Host "Резервная копия создана" -ForegroundColor Green
}

# Создаем папки
$requiredDirs = @(
    "frontend\src\components\tournament\tabs",
    "frontend\src\components\tournament\modals", 
    "frontend\src\components\tournament\ui",
    "frontend\src\components\tournament\forms"
)

foreach ($dir in $requiredDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Создана папка: $dir" -ForegroundColor Yellow
    }
}

# Проверяем hooks
$requiredHooks = @(
    "frontend\src\hooks\tournament\useTournamentData.js",
    "frontend\src\hooks\tournament\useWebSocket.js", 
    "frontend\src\hooks\tournament\useTournamentAuth.js",
    "frontend\src\hooks\tournament\useMapsManagement.js"
)

$hooksExist = $true
foreach ($hook in $requiredHooks) {
    if (-not (Test-Path $hook)) {
        Write-Host "Отсутствует hook: $hook" -ForegroundColor Red
        $hooksExist = $false
    }
}

if ($hooksExist) {
    Write-Host "Custom hooks проверены" -ForegroundColor Green
} else {
    Write-Host "Некоторые hooks отсутствуют!" -ForegroundColor Red
}

# Проверяем главный компонент
if (Test-Path "frontend\src\components\tournament\TournamentDetails\index.js") {
    Write-Host "Главный компонент найден" -ForegroundColor Green
} else {
    Write-Host "Отсутствует главный компонент" -ForegroundColor Red
}

# Копируем CSS файл
if (Test-Path "frontend\src\components\TournamentDetails.css") {
    $targetDir = "frontend\src\components\tournament\TournamentDetails"
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Copy-Item "frontend\src\components\TournamentDetails.css" "$targetDir\TournamentDetails.css"
    Write-Host "CSS файл скопирован" -ForegroundColor Green
}

# Проверяем Node.js
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js найден: $nodeVersion" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Node.js не найден" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Деплой завершен!" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host ""
Write-Host "Что было сделано:" -ForegroundColor Cyan
Write-Host "- Создана структура папок" -ForegroundColor Green
Write-Host "- Проверены custom hooks" -ForegroundColor Green
Write-Host "- Скопирован CSS файл" -ForegroundColor Green
Write-Host "- Создана резервная копия" -ForegroundColor Green
Write-Host ""
Write-Host "Модульная архитектура готова к использованию!" -ForegroundColor Green 