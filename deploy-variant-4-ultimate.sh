#!/bin/bash

# 🚀 ДЕПЛОЙ ВАРИАНТА 4: ULTIMATE РЕШЕНИЕ для статистики профиля
# ⭐ Real-time обновления, AI-анализ, система достижений, расширенная аналитика
# 🎯 Версия: 4.0 ULTIMATE - самое продвинутое решение

set -e

echo "🚀 РАЗВЕРТЫВАНИЕ ВАРИАНТА 4: ULTIMATE РЕШЕНИЕ"
echo "=============================================="
echo ""
echo "🎯 ЧТО БУДЕТ УСТАНОВЛЕНО:"
echo "   ✅ Real-time сервис статистики с WebSocket"
echo "   ✅ Система достижений и геймификации"
echo "   ✅ AI-анализ производительности"
echo "   ✅ Расширенные API endpoints v4"
echo "   ✅ Улучшенный React компонент с графиками"
echo "   ✅ Redis кэширование (опционально)"
echo "   ✅ Автоматическая интеграция с существующей системой"
echo ""

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: запустите скрипт из корневой директории проекта"
    echo "   Перейдите в папку проекта и запустите: ./deploy-variant-4-ultimate.sh"
    exit 1
fi

# Проверяем права на запись
if [ ! -w "." ]; then
    echo "❌ Ошибка: нет прав на запись в текущую директорию"
    echo "   Запустите с правами администратора: sudo ./deploy-variant-4-ultimate.sh"
    exit 1
fi

echo "🔍 Проверка зависимостей..."

# Проверяем Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 16+ и повторите попытку."
    exit 1
fi

# Проверяем npm/yarn
if command -v yarn &> /dev/null; then
    PACKAGE_MANAGER="yarn"
    INSTALL_CMD="yarn add"
    DEV_INSTALL_CMD="yarn add -D"
elif command -v npm &> /dev/null; then
    PACKAGE_MANAGER="npm"
    INSTALL_CMD="npm install"
    DEV_INSTALL_CMD="npm install --save-dev"
else
    echo "❌ npm или yarn не найдены. Установите один из них и повторите попытку."
    exit 1
fi

echo "✅ Найден менеджер пакетов: $PACKAGE_MANAGER"

# Проверяем PostgreSQL
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL найден"
    HAS_POSTGRES=true
else
    echo "⚠️ PostgreSQL не найден в PATH. Продолжаем без создания таблиц."
    HAS_POSTGRES=false
fi

# Функция для установки зависимостей
install_dependencies() {
    echo "📦 Установка зависимостей для варианта 4..."
    
    # Backend зависимости
    echo "   📦 Backend зависимости..."
    cd backend
    
    # WebSocket поддержка
    if ! grep -q "\"ws\"" package.json; then
        $INSTALL_CMD ws
        echo "   ✅ Установлен ws (WebSocket)"
    fi
    
    # Redis поддержка (опционально)
    if ! grep -q "\"redis\"" package.json; then
        $INSTALL_CMD redis
        echo "   ✅ Установлен redis"
    fi
    
    cd ..
    
    # Frontend зависимости
    echo "   📦 Frontend зависимости..."
    cd frontend
    
    # Chart.js для графиков
    if ! grep -q "\"chart.js\"" package.json; then
        $INSTALL_CMD chart.js react-chartjs-2
        echo "   ✅ Установлены Chart.js и react-chartjs-2"
    fi
    
    cd ..
    
    echo "✅ Все зависимости установлены"
}

# Функция создания таблиц БД
setup_database() {
    if [ "$HAS_POSTGRES" = true ]; then
        echo "🗄️ Создание таблиц базы данных..."
        
        # Создаем таблицу user_tournament_stats если нужно
        if [ -f "backend/create_user_tournament_stats_table.sql" ]; then
            echo "   📊 Создание таблицы user_tournament_stats..."
            if psql -U postgres -d 1337community -f backend/create_user_tournament_stats_table.sql 2>/dev/null; then
                echo "   ✅ Таблица user_tournament_stats создана/обновлена"
            else
                echo "   ⚠️ Не удалось создать таблицу user_tournament_stats (возможно, уже существует)"
            fi
        fi
        
        # Создаем таблицы для системы достижений
        echo "   🏆 Создание таблиц системы достижений..."
        cat > temp_achievements_tables.sql << 'EOF'
-- Создание таблиц для системы достижений (Вариант 4)

CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(50),
    rarity VARCHAR(20) DEFAULT 'common',
    points INTEGER DEFAULT 10,
    requirements JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_key VARCHAR(100),
    progress INTEGER DEFAULT 0,
    max_progress INTEGER DEFAULT 1,
    unlocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_key)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);
CREATE INDEX IF NOT EXISTS idx_achievements_rarity ON achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_key ON user_achievements(achievement_key);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(unlocked_at) WHERE unlocked_at IS NOT NULL;

-- Добавляем таблицу friends если не существует (для социальных достижений)
CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, friend_id)
);

NOTICE 'Таблицы для системы достижений созданы успешно';
EOF
        
        if psql -U postgres -d 1337community -f temp_achievements_tables.sql 2>/dev/null; then
            echo "   ✅ Таблицы системы достижений созданы"
        else
            echo "   ⚠️ Не удалось создать таблицы достижений"
        fi
        
        rm -f temp_achievements_tables.sql
        
        echo "✅ База данных настроена для варианта 4"
    else
        echo "⚠️ Пропуск настройки БД (PostgreSQL не найден)"
    fi
}

# Функция интеграции backend
integrate_backend() {
    echo "🔧 Интеграция backend компонентов..."
    
    # Добавляем routes для v4 API в server.js
    if [ -f "backend/server.js" ]; then
        echo "   🔌 Настройка server.js..."
        
        # Проверяем, нужно ли добавить импорты
        if ! grep -q "v4-enhanced-stats" backend/server.js; then
            # Создаем backup
            cp backend/server.js backend/server.js.backup
            
            # Добавляем импорты и маршруты в server.js
            cat > temp_server_additions.js << 'EOF'

// === ВАРИАНТ 4: ULTIMATE РЕШЕНИЕ ===
// Real-time сервис и система достижений
const realTimeStatsService = require('./services/realTimeStatsService');
const achievementSystem = require('./services/achievementSystem');
const v4EnhancedStatsRoutes = require('./routes/v4-enhanced-stats');

// V4 API маршруты
app.use('/api/v4', v4EnhancedStatsRoutes);

// Инициализация системы достижений
achievementSystem.initialize().catch(console.error);

// Инициализация real-time сервиса при запуске сервера
const server = app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    
    // Инициализируем WebSocket сервер
    realTimeStatsService.initialize(server).catch(console.error);
});

// === КОНЕЦ ВАРИАНТА 4 ===
EOF
            
            # Находим строку с app.listen и заменяем её
            sed -i.bak '/app\.listen/,/});/c\
// Код заменен для варианта 4 - см. выше' backend/server.js
            
            # Добавляем новый код перед последней строкой
            head -n -1 backend/server.js > temp_server.js
            cat temp_server_additions.js >> temp_server.js
            echo "" >> temp_server.js
            tail -n 1 backend/server.js >> temp_server.js
            mv temp_server.js backend/server.js
            
            rm temp_server_additions.js
            
            echo "   ✅ server.js настроен для варианта 4"
        else
            echo "   ℹ️ server.js уже настроен для варианта 4"
        fi
    else
        echo "   ❌ backend/server.js не найден"
    fi
    
    echo "✅ Backend интеграция завершена"
}

# Функция интеграции frontend
integrate_frontend() {
    echo "🎨 Интеграция frontend компонентов..."
    
    # Добавляем маршрут в App.js или главный роутер
    if [ -f "frontend/src/App.js" ]; then
        echo "   🔌 Настройка маршрутов в App.js..."
        
        if ! grep -q "V4EnhancedProfile" frontend/src/App.js; then
            # Создаем backup
            cp frontend/src/App.js frontend/src/App.js.backup
            
            # Добавляем импорт компонента
            sed -i '/import.*Profile/a import V4EnhancedProfile from '\''./components/V4EnhancedProfile'\'';' frontend/src/App.js
            
            # Добавляем маршрут
            sed -i '/Route.*profile/a \          <Route path="/profile-v4" element={<V4EnhancedProfile />} />' frontend/src/App.js
            
            echo "   ✅ Добавлен маршрут /profile-v4"
        else
            echo "   ℹ️ Маршрут уже существует"
        fi
    else
        echo "   ⚠️ frontend/src/App.js не найден - добавьте маршрут вручную"
    fi
    
    echo "✅ Frontend интеграция завершена"
}

# Функция создания документации
create_documentation() {
    echo "📚 Создание документации..."
    
    cat > VARIANT-4-ULTIMATE-GUIDE.md << 'EOF'
# 🚀 ВАРИАНТ 4: ULTIMATE РЕШЕНИЕ - Руководство пользователя

## 🎯 Что это такое

**Вариант 4** - это самое продвинутое решение для системы статистики игроков с:
- ⚡ **Real-time обновлениями** через WebSocket
- 🧠 **AI-анализом производительности**  
- 🏆 **Системой достижений и геймификации**
- 📊 **Интерактивными графиками и аналитикой**
- 💾 **Redis кэшированием для быстродействия**
- 🎮 **Интеграцией с внешними API**

---

## 🌟 Ключевые функции

### 🔌 Real-time обновления
- Статистика обновляется мгновенно без перезагрузки страницы
- WebSocket соединение с автоматическим переподключением
- Live уведомления о новых достижениях и событиях

### 🏆 Система достижений
- **12 категорий достижений**: турниры, игры, социальные, серии и др.
- **5 уровней редкости**: обычные, необычные, редкие, эпические, легендарные
- **Система очков** и глобальный рейтинг игроков
- **Прогресс-бары** для отслеживания прогресса

### 🤖 AI-анализ производительности
- Умный анализ игровой статистики
- Персональные рекомендации для улучшения
- Предсказание результатов следующих турниров
- Анализ лучшего времени для игры

### 📈 Расширенная аналитика
- Интерактивные графики производительности
- Анализ по играм и временным периодам
- История изменений рейтинга
- Сравнение с другими игроками

---

## 🚀 Как использовать

### 1. Доступ к новому профилю
Перейдите по адресу: `http://ваш-сайт.com/profile-v4`

### 2. Навигация по разделам
- **📊 Дашборд**: основные метрики, графики, AI-анализ
- **🏆 Достижения**: прогресс по всем категориям достижений  
- **👑 Лидерборд**: топ игроков по очкам достижений

### 3. Real-time функции
- Статус подключения отображается в правом верхнем углу
- Уведомления появляются автоматически при событиях
- Кнопка "🏆 Проверить достижения" для принудительной проверки

### 4. Интерактивные графики
- Переключайте периоды: 1м, 3м, 6м, 1г
- Наводите курсор для детальной информации
- Графики автоматически обновляются при изменении данных

---

## ⚙️ Для разработчиков

### API Endpoints

#### GET `/api/v4/stats/enhanced/:userId`
Получение расширенной статистики с real-time поддержкой

#### GET `/api/v4/achievements/:userId`
Получение достижений пользователя с прогрессом

#### GET `/api/v4/analysis/performance/:userId`
AI-анализ производительности игрока

#### GET `/api/v4/analytics/games/:userId`
Подробная аналитика по играм

#### POST `/api/v4/achievements/check/:userId`
Принудительная проверка новых достижений

### WebSocket Events

#### Подключение
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/stats');
```

#### События
- `stats_update` - обновление статистики
- `achievement_unlocked` - разблокировка достижения
- `tournament_analysis` - обновление AI-анализа

### Система достижений

#### Категории
- `tournaments` - турнирные достижения
- `games` - игровые достижения  
- `social` - социальные достижения
- `streaks` - серии побед
- `performance` - производительность
- `special` - особые достижения

#### Редкость
- `common` (серый) - 10-25 очков
- `uncommon` (зеленый) - 30-50 очков
- `rare` (синий) - 75-100 очков
- `epic` (фиолетовый) - 150-200 очков
- `legendary` (оранжевый) - 250-500 очков

---

## 🔧 Настройка и развертывание

### Требования
- Node.js 16+
- PostgreSQL 12+
- Redis (опционально)
- Modern браузер с поддержкой WebSocket

### Установка
```bash
# Клонирование и установка зависимостей
./deploy-variant-4-ultimate.sh
```

### Переменные окружения
```env
REDIS_HOST=localhost
REDIS_PORT=6379
INTERNAL_API_TOKEN=your-secret-token
WEBSOCKET_PORT=3001
```

### Структура файлов
```
backend/
├── services/
│   ├── realTimeStatsService.js
│   └── achievementSystem.js
├── routes/
│   └── v4-enhanced-stats.js
frontend/
├── components/
│   ├── V4EnhancedProfile.js
│   └── V4EnhancedProfile.css
```

---

## 🐛 Решение проблем

### WebSocket не подключается
1. Проверьте, что сервер запущен
2. Убедитесь, что порт не заблокирован
3. Проверьте настройки прокси-сервера

### Достижения не обновляются
1. Проверьте, что таблицы созданы в БД
2. Запустите принудительную проверку
3. Проверьте логи сервера

### Графики не отображаются
1. Убедитесь, что Chart.js установлен
2. Проверьте данные в API
3. Откройте консоль браузера для ошибок

### Медленная работа
1. Включите Redis кэширование
2. Проверьте индексы в БД
3. Оптимизируйте WebSocket соединения

---

## 🎮 Геймификация

### Как зарабатывать очки
- Участие в турнирах: 10+ очков
- Победы в турнирах: 25+ очков
- Серии побед: 75+ очков
- Социальная активность: 15+ очков
- Особые достижения: 200+ очков

### Стратегии прогресса
1. **Новичок**: участвуйте в турнирах для базовых достижений
2. **Игрок**: фокус на победах и топ-3 финишах
3. **Эксперт**: стройте серии побед и идеальные турниры
4. **Легенда**: социальная активность и долгосрочные достижения

---

## 🔄 Обновления и поддержка

Версия 4.0 включает автоматические обновления:
- Статистика пересчитывается в режиме реального времени
- Новые достижения добавляются автоматически
- AI-анализ улучшается с каждым турниром
- Система самодиагностики и восстановления

Для поддержки обращайтесь к разработчикам или создавайте issue в репозитории.

---

*🎯 Вариант 4 - это не просто профиль, это персональный игровой дашборд будущего!*
EOF

    echo "✅ Создана документация VARIANT-4-ULTIMATE-GUIDE.md"
}

# Функция финальной проверки
final_check() {
    echo "🔍 Финальная проверка установки..."
    
    local errors=0
    
    # Проверяем файлы backend
    if [ ! -f "backend/services/realTimeStatsService.js" ]; then
        echo "   ❌ backend/services/realTimeStatsService.js не найден"
        ((errors++))
    fi
    
    if [ ! -f "backend/services/achievementSystem.js" ]; then
        echo "   ❌ backend/services/achievementSystem.js не найден"
        ((errors++))
    fi
    
    if [ ! -f "backend/routes/v4-enhanced-stats.js" ]; then
        echo "   ❌ backend/routes/v4-enhanced-stats.js не найден"
        ((errors++))
    fi
    
    # Проверяем файлы frontend
    if [ ! -f "frontend/src/components/V4EnhancedProfile.js" ]; then
        echo "   ❌ frontend/src/components/V4EnhancedProfile.js не найден"
        ((errors++))
    fi
    
    if [ ! -f "frontend/src/components/V4EnhancedProfile.css" ]; then
        echo "   ❌ frontend/src/components/V4EnhancedProfile.css не найден"
        ((errors++))
    fi
    
    # Проверяем зависимости backend
    cd backend
    if ! grep -q "\"ws\"" package.json; then
        echo "   ❌ WebSocket зависимость (ws) не установлена"
        ((errors++))
    fi
    cd ..
    
    # Проверяем зависимости frontend  
    cd frontend
    if ! grep -q "\"chart.js\"" package.json; then
        echo "   ❌ Chart.js зависимости не установлены"
        ((errors++))
    fi
    cd ..
    
    if [ $errors -eq 0 ]; then
        echo "✅ Все компоненты установлены корректно"
        return 0
    else
        echo "❌ Найдено $errors ошибок установки"
        return 1
    fi
}

# Главная функция
main() {
    echo "🎬 Начало установки варианта 4..."
    
    # Этап 1: Установка зависимостей
    install_dependencies
    
    # Этап 2: Настройка базы данных
    setup_database
    
    # Этап 3: Интеграция backend
    integrate_backend
    
    # Этап 4: Интеграция frontend
    integrate_frontend
    
    # Этап 5: Создание документации
    create_documentation
    
    # Этап 6: Финальная проверка
    if final_check; then
        echo ""
        echo "🎉 УСТАНОВКА ВАРИАНТА 4 ЗАВЕРШЕНА УСПЕШНО!"
        echo "============================================"
        echo ""
        echo "🚀 ЧТО ДАЛЬШЕ:"
        echo "   1. Перезапустите backend сервер: cd backend && npm start"
        echo "   2. Пересоберите frontend: cd frontend && npm run build"
        echo "   3. Откройте /profile-v4 в браузере"
        echo "   4. Прочитайте VARIANT-4-ULTIMATE-GUIDE.md"
        echo ""
        echo "🔗 ПОЛЕЗНЫЕ ССЫЛКИ:"
        echo "   📊 Новый профиль: http://localhost:3000/profile-v4"
        echo "   🏆 API достижений: http://localhost:3000/api/v4/achievements/1"
        echo "   📈 API аналитики: http://localhost:3000/api/v4/analytics/games/1"
        echo "   📚 Документация: ./VARIANT-4-ULTIMATE-GUIDE.md"
        echo ""
        echo "⭐ Наслаждайтесь самым продвинутым профилем статистики!"
    else
        echo ""
        echo "⚠️ УСТАНОВКА ЗАВЕРШЕНА С ОШИБКАМИ"
        echo "=================================="
        echo ""
        echo "🔧 РЕШЕНИЕ ПРОБЛЕМ:"
        echo "   1. Проверьте права доступа к файлам"
        echo "   2. Убедитесь, что все зависимости установлены"
        echo "   3. Проверьте подключение к базе данных"
        echo "   4. Запустите скрипт еще раз: ./deploy-variant-4-ultimate.sh"
        echo ""
        echo "📞 При проблемах обращайтесь к разработчикам"
    fi
}

# Запуск главной функции
main "$@" 