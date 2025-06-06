# 🚀 Инструкции по развертыванию обновлений на VDS

## 📋 **ЧТО БЫЛО ДОБАВЛЕНО:**

### ✅ **Основное исправление:**
- **Проблема**: В блоке "Призеры турнира" ничего не отображалось для завершенных турниров
- **Решение**: Добавлена система динамического определения призеров + каждый участник команды теперь призер

### 🎯 **Новая особенность:**
- **Индивидуальные призеры**: Каждый участник команды-победителя получает статус призера
- **Статистика**: Правильный учет всех участников команды в базе данных

### 🔧 **Исправление миграции:**
- **Проблема**: Ошибка foreign key constraint в tournament_logs
- **Решение**: Миграция теперь безопасно проверяет существование турниров

## 🖥️ **КОМАНДЫ ДЛЯ РАЗВЕРТЫВАНИЯ НА VDS:**

### 1. Подключение к серверу:
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Переход в директорию проекта:
```bash
cd /var/www/1337community.com/
```

### 3. Получение обновлений из GitHub:
```bash
git pull origin main
```

### 4. Применение миграции базы данных:

#### Способ 1 - Прямое выполнение файла (рекомендуется):
```bash
# Подключение к PostgreSQL
sudo -u postgres psql

# Выбор базы данных (замените на название вашей БД)
\c your_database_name

# Выполнение миграции
\i database/migrations/add_tournament_winners.sql

# Выход из PostgreSQL
\q
```

#### Способ 2 - Ручное выполнение команд (если есть проблемы):
```bash
sudo -u postgres psql your_database_name << 'EOF'
-- Добавляем поля для призеров в tournaments
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS winner_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS winner_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS second_place_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS second_place_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS third_place_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS third_place_name VARCHAR(255) DEFAULT NULL;

-- Добавляем поля для команд в user_tournament_stats
ALTER TABLE user_tournament_stats
ADD COLUMN IF NOT EXISTS team_name VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_team_member BOOLEAN DEFAULT FALSE;

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_tournaments_winner_id ON tournaments(winner_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_second_place_id ON tournaments(second_place_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_third_place_id ON tournaments(third_place_id);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_team_name ON user_tournament_stats(team_name);
CREATE INDEX IF NOT EXISTS idx_user_tournament_stats_is_team_member ON user_tournament_stats(is_team_member);

COMMIT;
EOF
```

### 5. Установка зависимостей (если нужно):
```bash
# Backend зависимости
npm install

# Frontend зависимости
cd frontend
npm install
cd ..
```

### 6. Сборка frontend:
```bash
cd frontend
npm run build
cd ..
```

### 7. Перезапуск backend сервиса:
```bash
# Если используется PM2
pm2 restart 1337-backend

# Или если используется systemctl
systemctl restart 1337-backend
```

### 8. Перезагрузка Nginx:
```bash
systemctl reload nginx
```

## 🔍 **ПРОВЕРКА РАБОТОСПОСОБНОСТИ:**

### 1. Проверка статуса сервисов:
```bash
# Проверка backend
pm2 status
# или
systemctl status 1337-backend

# Проверка Nginx
systemctl status nginx
```

### 2. Проверка логов:
```bash
# Логи backend (PM2)
pm2 logs 1337-backend

# Логи Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### 3. Проверка базы данных:
```bash
# Проверяем, что новые поля добавлены
sudo -u postgres psql your_database_name -c "\d+ tournaments"
sudo -u postgres psql your_database_name -c "\d+ user_tournament_stats"

# Проверяем конкретные поля
sudo -u postgres psql your_database_name -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name IN ('winner_id', 'winner_name', 'second_place_id', 'third_place_id');"
```

## ✅ **ПРОВЕРКА ФУНКЦИОНАЛА:**

1. **Откройте завершенный турнир** на сайте
2. **Проверьте блок "Призеры турнира"** - должен отображаться с подиумом
3. **Для командных турниров** - проверьте, что каждый участник команды показан как призер
4. **Кликните по именам игроков** - должны вести на профили

## 🚨 **В СЛУЧАЕ ПРОБЛЕМ:**

### Если ошибка foreign key constraint:
```bash
# Проверьте, есть ли турниры в базе
sudo -u postgres psql your_database_name -c "SELECT COUNT(*) FROM tournaments;"

# Проверьте, существует ли таблица tournament_logs
sudo -u postgres psql your_database_name -c "\dt tournament_logs"

# Если нужно, создайте таблицу tournament_logs
sudo -u postgres psql your_database_name -c "CREATE TABLE IF NOT EXISTS tournament_logs (id SERIAL PRIMARY KEY, tournament_id INTEGER, user_id INTEGER, event_type VARCHAR(255), event_data JSONB, created_at TIMESTAMP DEFAULT NOW());"
```

### Если призеры не отображаются:
```bash
# Проверьте консоль браузера на ошибки JavaScript
# Проверьте логи backend на ошибки API
pm2 logs 1337-backend --lines 50
```

### Если 500 ошибка сервера:
```bash
# Проверьте логи Nginx и backend
tail -f /var/log/nginx/error.log
pm2 logs 1337-backend --lines 20
```

### Проверка успешности миграции:
```bash
# Проверим, что все поля созданы
sudo -u postgres psql your_database_name << 'EOF'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tournaments' 
            AND column_name IN ('winner_id', 'winner_name', 'second_place_id', 'third_place_id')
        ) THEN '✅ Поля tournaments созданы'
        ELSE '❌ Поля tournaments НЕ созданы'
    END as tournaments_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_tournament_stats' 
            AND column_name IN ('team_name', 'is_team_member')
        ) THEN '✅ Поля user_tournament_stats созданы'
        ELSE '❌ Поля user_tournament_stats НЕ созданы'
    END as stats_status;
EOF
```

## 📁 **ОСНОВНЫЕ ИЗМЕНЕННЫЕ ФАЙЛЫ:**

- `backend/routes/tournaments.js` - ✅ Обновлен
- `database/migrations/add_tournament_winners.sql` - ✅ Исправлен (убрана ошибка foreign key)
- `frontend/src/components/TournamentDetails.js` - ✅ Обновлен
- `frontend/src/components/TournamentDetails.css` - ✅ Обновлен

## 🎯 **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:**

После развертывания пользователи увидят:
- ✅ **Блок призеров** отображается для всех завершенных турниров
- ✅ **Каждый участник команды** показан как индивидуальный призер с медалью
- ✅ **Ссылки на профили** работают корректно
- ✅ **Красивые анимации** и стили для призеров
- ✅ **Корректная статистика** для всех участников команд

---

📞 **Поддержка**: Если возникли проблемы, проверьте файл `individual_winners_update.md` для детального описания изменений. 