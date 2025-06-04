#!/bin/bash

# 🚀 СКРИПТ ДЕПЛОЯ: Модульная архитектура TournamentDetails
# Заменяет монолитный компонент на модульную структуру

echo "🚀 НАЧИНАЕМ ДЕПЛОЙ МОДУЛЬНОЙ АРХИТЕКТУРЫ..."
echo "================================================="

# Функция для отображения прогресса
show_progress() {
    echo "✅ $1"
}

# Функция для отображения ошибок
show_error() {
    echo "❌ ОШИБКА: $1"
    exit 1
}

# Проверяем, что мы в корне проекта
if [ ! -f "package.json" ] || [ ! -d "frontend" ]; then
    show_error "Запустите скрипт из корня проекта!"
fi

show_progress "Проверка структуры проекта..."

# Создаем резервную копию текущего TournamentDetails.js
echo "📦 Создание резервной копии..."
cp frontend/src/components/TournamentDetails.js frontend/src/components/TournamentDetails.js.backup.$(date +%Y%m%d_%H%M%S)
show_progress "Резервная копия создана"

# Проверяем, что все папки созданы
echo "📁 Проверка структуры папок..."
REQUIRED_DIRS=(
    "frontend/src/hooks/tournament"
    "frontend/src/components/tournament/tabs"
    "frontend/src/components/tournament/modals"
    "frontend/src/components/tournament/ui"
    "frontend/src/components/tournament/forms"
    "frontend/src/services/tournament"
    "frontend/src/utils/tournament"
    "frontend/src/context/tournament"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "📁 Создаем папку: $dir"
        mkdir -p "$dir"
    fi
done
show_progress "Структура папок готова"

# Проверяем, что все hooks созданы
echo "🎣 Проверка custom hooks..."
REQUIRED_HOOKS=(
    "frontend/src/hooks/tournament/useTournamentData.js"
    "frontend/src/hooks/tournament/useWebSocket.js"
    "frontend/src/hooks/tournament/useTournamentAuth.js"
    "frontend/src/hooks/tournament/useMapsManagement.js"
)

for hook in "${REQUIRED_HOOKS[@]}"; do
    if [ ! -f "$hook" ]; then
        show_error "Отсутствует hook: $hook"
    fi
done
show_progress "Custom hooks проверены"

# Проверяем главный компонент
if [ ! -f "frontend/src/components/tournament/TournamentDetails/index.js" ]; then
    show_error "Отсутствует главный компонент: frontend/src/components/tournament/TournamentDetails/index.js"
fi
show_progress "Главный компонент найден"

# Создаем заглушки для компонентов, которые еще не созданы
echo "🧩 Создание заглушек для компонентов..."

# TournamentHeader
if [ ! -f "frontend/src/components/tournament/TournamentDetails/TournamentHeader.js" ]; then
    cat > frontend/src/components/tournament/TournamentDetails/TournamentHeader.js << 'EOF'
import React from 'react';

const TournamentHeader = ({ tournament, activeTab, setActiveTab, visibleTabs, wsConnected }) => {
    return (
        <div className="tournament-header-tournamentdetails">
            <h2>
                {tournament.name} ({
                    tournament.status === 'active' || tournament.status === 'pending' ? 'Активен' : 
                    tournament.status === 'in_progress' ? 'Идет' : 
                    tournament.status === 'completed' || tournament.status === 'завершен' ? 'Завершен' : 
                    'Неизвестный статус'
                })
                {wsConnected && <span className="ws-indicator">🟢</span>}
            </h2>
            
            <div className="tabs-navigation-tournamentdetails">
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button-tournamentdetails ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="tab-label-tournamentdetails">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default TournamentHeader;
EOF
    show_progress "TournamentHeader создан"
fi

# Создаем заглушки для вкладок
TAB_COMPONENTS=("InfoTab" "ParticipantsTab" "BracketTab" "ResultsTab" "LogsTab" "StreamsTab" "AdminTab")

for component in "${TAB_COMPONENTS[@]}"; do
    file="frontend/src/components/tournament/tabs/${component}.js"
    if [ ! -f "$file" ]; then
        cat > "$file" << EOF
import React from 'react';

const ${component} = (props) => {
    return (
        <div className="tab-content tab-${component,,}">
            <h3>${component}</h3>
            <p>Компонент ${component} в разработке...</p>
            <pre>{JSON.stringify(props, null, 2)}</pre>
        </div>
    );
};

export default ${component};
EOF
        show_progress "${component} создан"
    fi
done

# Создаем заглушки для модальных окон
MODAL_COMPONENTS=("ConfirmWinnerModal" "MatchDetailsModal" "EditMatchModal" "TeamCompositionModal" "EndTournamentModal" "ClearResultsModal")

for component in "${MODAL_COMPONENTS[@]}"; do
    file="frontend/src/components/tournament/modals/${component}.js"
    if [ ! -f "$file" ]; then
        cat > "$file" << EOF
import React from 'react';

const ${component} = ({ isOpen, onClose, ...props }) => {
    if (!isOpen) return null;

    return (
        <div className="modal" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>${component}</h3>
                <p>Модальное окно ${component} в разработке...</p>
                <button onClick={onClose}>Закрыть</button>
                <pre>{JSON.stringify(props, null, 2)}</pre>
            </div>
        </div>
    );
};

export default ${component};
EOF
        show_progress "${component} создан"
    fi
done

# Копируем CSS файл
if [ -f "frontend/src/components/TournamentDetails.css" ]; then
    cp frontend/src/components/TournamentDetails.css frontend/src/components/tournament/TournamentDetails/TournamentDetails.css
    show_progress "CSS файл скопирован"
fi

# Создаем временный маршрут для тестирования новой архитектуры
echo "🔄 Создание тестового маршрута..."
cat > frontend/src/components/tournament/TournamentDetails/TestRoute.js << 'EOF'
// Временный файл для тестирования новой архитектуры
// После тестирования заменит оригинальный TournamentDetails.js

import TournamentDetails from './index';
export default TournamentDetails;
EOF

# Обновляем package.json с новыми зависимостями
echo "📦 Проверка зависимостей..."
if command -v node >/dev/null 2>&1; then
    echo "Node.js найден, проверяем зависимости..."
    cd frontend
    
    # Проверяем, что все необходимые пакеты установлены
    npm list react react-router-dom socket.io-client >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "Устанавливаем зависимости..."
        npm install
    fi
    cd ..
    show_progress "Зависимости проверены"
fi

# Создаем файл с инструкциями по миграции
cat > MIGRATION_GUIDE.md << 'EOF'
# 📋 РУКОВОДСТВО ПО МИГРАЦИИ

## Этапы перехода на модульную архитектуру:

### 1. Тестирование (ТЕКУЩИЙ ЭТАП)
- ✅ Базовая структура создана
- ⏳ Тестируйте новый компонент: `/src/components/tournament/TournamentDetails/TestRoute.js`
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
Старый файл сохранен как `TournamentDetails.js.backup.ДАТА`
EOF

echo ""
echo "🎉 ДЕПЛОЙ МОДУЛЬНОЙ АРХИТЕКТУРЫ ЗАВЕРШЕН!"
echo "================================================="
echo ""
echo "📋 ЧТО БЫЛО СДЕЛАНО:"
echo "✅ Создана структура папок"
echo "✅ Проверены custom hooks"
echo "✅ Создан главный компонент-координатор"
echo "✅ Созданы заглушки для всех компонентов"
echo "✅ Скопирован CSS файл"
echo "✅ Создан тестовый маршрут"
echo "✅ Создана резервная копия"
echo ""
echo "📋 СЛЕДУЮЩИЕ ШАГИ:"
echo "1. Протестируйте новую архитектуру:"
echo "   import TournamentDetails from './components/tournament/TournamentDetails/TestRoute';"
echo ""
echo "2. Замените заглушки на реальные компоненты"
echo ""
echo "3. Проведите полную миграцию"
echo ""
echo "📖 Полное руководство: MIGRATION_GUIDE.md"
echo ""
echo "🚀 Модульная архитектура готова к использованию!" 