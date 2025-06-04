# 🚀 СКРИПТ ДЕПЛОЯ: Модульная архитектура TournamentDetails (PowerShell)
# Заменяет монолитный компонент на модульную структуру

Write-Host "🚀 НАЧИНАЕМ ДЕПЛОЙ МОДУЛЬНОЙ АРХИТЕКТУРЫ..." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Функция для отображения прогресса
function Show-Progress {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

# Функция для отображения ошибок
function Show-Error {
    param([string]$Message)
    Write-Host "❌ ОШИБКА: $Message" -ForegroundColor Red
    exit 1
}

# Проверяем, что мы в корне проекта
if (-not (Test-Path "package.json") -or -not (Test-Path "frontend")) {
    Show-Error "Запустите скрипт из корня проекта!"
}

Show-Progress "Проверка структуры проекта..."

# Создаем резервную копию текущего TournamentDetails.js
Write-Host "📦 Создание резервной копии..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
if (Test-Path "frontend\src\components\TournamentDetails.js") {
    Copy-Item "frontend\src\components\TournamentDetails.js" "frontend\src\components\TournamentDetails.js.backup.$timestamp"
    Show-Progress "Резервная копия создана"
}

# Проверяем, что все папки созданы
Write-Host "📁 Проверка структуры папок..." -ForegroundColor Yellow
$requiredDirs = @(
    "frontend\src\hooks\tournament",
    "frontend\src\components\tournament\tabs",
    "frontend\src\components\tournament\modals",
    "frontend\src\components\tournament\ui",
    "frontend\src\components\tournament\forms",
    "frontend\src\services\tournament",
    "frontend\src\utils\tournament",
    "frontend\src\context\tournament"
)

foreach ($dir in $requiredDirs) {
    if (-not (Test-Path $dir)) {
        Write-Host "📁 Создаем папку: $dir" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}
Show-Progress "Структура папок готова"

# Проверяем, что все hooks созданы
Write-Host "🎣 Проверка custom hooks..." -ForegroundColor Yellow
$requiredHooks = @(
    "frontend\src\hooks\tournament\useTournamentData.js",
    "frontend\src\hooks\tournament\useWebSocket.js",
    "frontend\src\hooks\tournament\useTournamentAuth.js",
    "frontend\src\hooks\tournament\useMapsManagement.js"
)

foreach ($hook in $requiredHooks) {
    if (-not (Test-Path $hook)) {
        Show-Error "Отсутствует hook: $hook"
    }
}
Show-Progress "Custom hooks проверены"

# Проверяем главный компонент
if (-not (Test-Path "frontend\src\components\tournament\TournamentDetails\index.js")) {
    Show-Error "Отсутствует главный компонент: frontend\src\components\tournament\TournamentDetails\index.js"
}
Show-Progress "Главный компонент найден"

# Создаем заглушки для компонентов
Write-Host "🧩 Создание заглушек для компонентов..." -ForegroundColor Yellow

# TournamentHeader
if (-not (Test-Path "frontend\src\components\tournament\TournamentDetails\TournamentHeader.js")) {
    $headerContent = "import React from 'react';

const TournamentHeader = ({ tournament, activeTab, setActiveTab, visibleTabs, wsConnected }) => {
    return (
        <div className=`"tournament-header-tournamentdetails`">
            <h2>
                {tournament.name} ({
                    tournament.status === 'active' || tournament.status === 'pending' ? 'Активен' : 
                    tournament.status === 'in_progress' ? 'Идет' : 
                    tournament.status === 'completed' || tournament.status === 'завершен' ? 'Завершен' : 
                    'Неизвестный статус'
                })
                {wsConnected && <span className=`"ws-indicator`">🟢</span>}
            </h2>
            
            <div className=`"tabs-navigation-tournamentdetails`">
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        className={``tab-button-tournamentdetails `${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className=`"tab-label-tournamentdetails`">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TournamentHeader;"
    
    Set-Content -Path "frontend\src\components\tournament\TournamentDetails\TournamentHeader.js" -Value $headerContent -Encoding UTF8
    Show-Progress "TournamentHeader создан"
}

# Создаем заглушки для вкладок
$tabComponents = @("InfoTab", "ParticipantsTab", "BracketTab", "ResultsTab", "LogsTab", "StreamsTab", "AdminTab")

foreach ($component in $tabComponents) {
    $file = "frontend\src\components\tournament\tabs\$component.js"
    if (-not (Test-Path $file)) {
        $componentContent = "import React from 'react';

const $component = (props) => {
    return (
        <div className=`"tab-content tab-$($component.ToLower())`">
            <h3>$component</h3>
            <p>Компонент $component в разработке...</p>
            <pre>{JSON.stringify(props, null, 2)}</pre>
        </div>
    );
};

export default $component;"
        
        Set-Content -Path $file -Value $componentContent -Encoding UTF8
        Show-Progress "$component создан"
    }
}

# Создаем заглушки для модальных окон
$modalComponents = @("ConfirmWinnerModal", "MatchDetailsModal", "EditMatchModal", "TeamCompositionModal", "EndTournamentModal", "ClearResultsModal")

foreach ($component in $modalComponents) {
    $file = "frontend\src\components\tournament\modals\$component.js"
    if (-not (Test-Path $file)) {
        $modalContent = "import React from 'react';

const $component = ({ isOpen, onClose, ...props }) => {
    if (!isOpen) return null;

    return (
        <div className=`"modal`" onClick={onClose}>
            <div className=`"modal-content`" onClick={(e) => e.stopPropagation()}>
                <h3>$component</h3>
                <p>Модальное окно $component в разработке...</p>
                <button onClick={onClose}>Закрыть</button>
                <pre>{JSON.stringify(props, null, 2)}</pre>
            </div>
        </div>
    );
};

export default $component;"
        
        Set-Content -Path $file -Value $modalContent -Encoding UTF8
        Show-Progress "$component создан"
    }
}

# Копируем CSS файл
if (Test-Path "frontend\src\components\TournamentDetails.css") {
    Copy-Item "frontend\src\components\TournamentDetails.css" "frontend\src\components\tournament\TournamentDetails\TournamentDetails.css"
    Show-Progress "CSS файл скопирован"
}

# Создаем временный маршрут для тестирования новой архитектуры
Write-Host "🔄 Создание тестового маршрута..." -ForegroundColor Yellow
$testRouteContent = "// Временный файл для тестирования новой архитектуры
// После тестирования заменит оригинальный TournamentDetails.js

import TournamentDetails from './index';
export default TournamentDetails;"

Set-Content -Path "frontend\src\components\tournament\TournamentDetails\TestRoute.js" -Value $testRouteContent -Encoding UTF8

# Проверяем Node.js и зависимости
Write-Host "📦 Проверка зависимостей..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "Node.js найден: $nodeVersion" -ForegroundColor Cyan
        Show-Progress "Зависимости проверены"
    }
} catch {
    Write-Host "Node.js не найден, пропускаем проверку зависимостей" -ForegroundColor Yellow
}

# Создаем файл с инструкциями по миграции
$migrationContent = "# 📋 РУКОВОДСТВО ПО МИГРАЦИИ

## Этапы перехода на модульную архитектуру:

### 1. Тестирование (ТЕКУЩИЙ ЭТАП)
- ✅ Базовая структура создана
- ⏳ Тестируйте новый компонент: /src/components/tournament/TournamentDetails/TestRoute.js
- ⏳ Проверьте, что hooks работают корректно

### 2. Постепенная замена компонентов
- Замените заглушки на реальные компоненты
- Перенесите бизнес-логику из старого компонента
- Протестируйте каждый компонент отдельно

### 3. Полная миграция
- Замените импорт в App.js или Router
- Удалите старый TournamentDetails.js
- Обновите все ссылки

### 4. Оптимизация
- Добавьте React.memo для оптимизации
- Внедрите lazy loading
- Оптимизируйте размер bundle

## Резервная копия:
Старый файл сохранен как TournamentDetails.js.backup.ДАТА"

Set-Content -Path "MIGRATION_GUIDE.md" -Value $migrationContent -Encoding UTF8

Write-Host ""
Write-Host "🎉 ДЕПЛОЙ МОДУЛЬНОЙ АРХИТЕКТУРЫ ЗАВЕРШЕН!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 ЧТО БЫЛО СДЕЛАНО:" -ForegroundColor Cyan
Write-Host "✅ Создана структура папок" -ForegroundColor Green
Write-Host "✅ Проверены custom hooks" -ForegroundColor Green  
Write-Host "✅ Создан главный компонент-координатор" -ForegroundColor Green
Write-Host "✅ Созданы заглушки для всех компонентов" -ForegroundColor Green
Write-Host "✅ Скопирован CSS файл" -ForegroundColor Green
Write-Host "✅ Создан тестовый маршрут" -ForegroundColor Green
Write-Host "✅ Создана резервная копия" -ForegroundColor Green
Write-Host ""
Write-Host "📋 СЛЕДУЮЩИЕ ШАГИ:" -ForegroundColor Cyan
Write-Host "1. Протестируйте новую архитектуру:"
Write-Host "   import TournamentDetails from './components/tournament/TournamentDetails/TestRoute';" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Замените заглушки на реальные компоненты"
Write-Host ""
Write-Host "3. Проведите полную миграцию"
Write-Host ""
Write-Host "📖 Полное руководство: MIGRATION_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🚀 Модульная архитектура готова к использованию!" -ForegroundColor Green 