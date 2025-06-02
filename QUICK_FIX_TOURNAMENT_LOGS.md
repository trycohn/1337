# 🔧 БЫСТРОЕ ИСПРАВЛЕНИЕ: Ошибка журнала событий турнира

## 🚨 Проблема
```
GET https://1337community.com/api/tournaments/54/logs 500 (Internal Server Error)
API Error (500): {error: 'Ошибка сервера'}
```

## ✅ Решение
Отсутствует таблица `tournament_logs` в базе данных.

## 🚀 Быстрое исправление

### 1. Подключение к серверу
```bash
ssh your-username@1337community.com
cd /path/to/your/project/1337
```

### 2. Применение SQL миграции

**Вариант А (через файл):**
```bash
sudo -u postgres psql your_database_name < backend/migrations/create_tournament_logs_table.sql
```

**Вариант Б (прямое выполнение SQL):**
```bash
sudo -u postgres psql your_database_name
```

Затем выполните:
```sql
-- Создание таблицы tournament_logs
CREATE TABLE IF NOT EXISTS tournament_logs (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_tournament_logs_tournament_id ON tournament_logs(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_created_at ON tournament_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_logs_event_type ON tournament_logs(event_type);

-- Проверка успешного создания
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tournament_logs') THEN
        RAISE NOTICE 'Таблица tournament_logs успешно создана';
    ELSE
        RAISE EXCEPTION 'Ошибка создания таблицы tournament_logs';
    END IF;
END $$;

\q
```

### 3. Перезапуск приложения
```bash
# PM2
pm2 restart all

# ИЛИ systemctl
sudo systemctl restart your-node-app

# ИЛИ Docker
docker-compose restart backend
```

### 4. Проверка
1. Откройте любой турнир на сайте
2. Перейдите на вкладку "Журнал событий"
3. Убедитесь, что ошибка 500 исчезла

## 📋 Что будет работать после исправления

- ✅ Вкладка "Журнал событий" в турнирах
- ✅ Отображение истории действий:
  - Создание турнира
  - Регистрация участников  
  - Генерация сетки
  - Начало/завершение турнира
  - Результаты матчей

## 🛡️ Безопасность

⚠️ **ОБЯЗАТЕЛЬНО**: Создайте бэкап БД перед применением:
```bash
sudo -u postgres pg_dump your_database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 🐛 Troubleshooting

**Проблема**: `permission denied`
```bash
sudo -u postgres psql
GRANT CREATE ON DATABASE your_database_name TO your_db_user;
```

**Проблема**: `relation "tournaments" does not exist`
```bash
# Проверьте существование основных таблиц
sudo -u postgres psql your_database_name
\dt tournaments
```

**Проблема**: `syntax error at or near "RAISE"`
✅ **Исправлено!** Обновленный SQL код выше содержит правильный синтаксис.

---

💡 **Готово!** После применения миграции журнал событий будет работать корректно. 