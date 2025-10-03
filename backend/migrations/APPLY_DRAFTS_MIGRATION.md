# 📋 ИНСТРУКЦИЯ: ПРИМЕНЕНИЕ МИГРАЦИИ ЧЕРНОВИКОВ ТУРНИРОВ

**Дата создания:** 3 октября 2025  
**Версия:** 1.0.0  
**Файл миграции:** `backend/migrations/20251003_create_tournament_drafts.sql`

---

## 🎯 ЧТО ДЕЛАЕТ МИГРАЦИЯ

Создает систему черновиков для Wizard-интерфейса создания турниров:

✅ Таблица `tournament_drafts` - хранение черновиков  
✅ Индексы для производительности  
✅ Функция `cleanup_expired_drafts()` - очистка устаревших  
✅ Триггер автообновления `last_saved_at`  
✅ Row Level Security для изоляции данных

---

## 🚀 ПРИМЕНЕНИЕ МИГРАЦИИ

### Вариант 1: Через SSH на VDS (рекомендуется)

```bash
# 1. Подключаемся к серверу
ssh root@80.87.200.23

# 2. Переходим в директорию проекта
cd /var/www/1337community.com/

# 3. Применяем миграцию
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_create_tournament_drafts.sql

# 4. Проверяем результат
sudo -u postgres psql -d tournament_db -c "SELECT COUNT(*) FROM tournament_drafts;"
```

### Вариант 2: Через локальный PGAdmin

```sql
-- 1. Откройте PGAdmin
-- 2. Подключитесь к базе tournament_db
-- 3. Откройте Query Tool (правый клик на БД → Query Tool)
-- 4. Скопируйте содержимое файла 20251003_create_tournament_drafts.sql
-- 5. Нажмите Execute (F5)
```

### Вариант 3: Через psql локально

```bash
# Если у вас есть доступ к PostgreSQL локально
psql -U your_user -d tournament_db -f backend/migrations/20251003_create_tournament_drafts.sql
```

---

## ✅ ПРОВЕРКА УСПЕШНОСТИ МИГРАЦИИ

После применения миграции выполните проверочные запросы:

```sql
-- 1. Проверка создания таблицы
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'tournament_drafts'
);
-- Ожидаемый результат: true

-- 2. Проверка структуры таблицы
\d tournament_drafts;
-- Должно показать все колонки

-- 3. Проверка индексов
SELECT indexname FROM pg_indexes 
WHERE tablename = 'tournament_drafts';
-- Должно вернуть 3 индекса

-- 4. Проверка функции очистки
SELECT cleanup_expired_drafts();
-- Должно вернуть 0 (нет устаревших черновиков)

-- 5. Тестовая вставка (опционально)
INSERT INTO tournament_drafts (
    user_id, 
    draft_data, 
    current_step,
    draft_name
) VALUES (
    1, 
    '{"basicInfo": {"name": "Test Draft"}}'::jsonb,
    2,
    'Тестовый черновик'
);

-- 6. Проверка вставки
SELECT * FROM tournament_drafts;
```

---

## 🔄 ОТКАТ МИГРАЦИИ (если нужно)

```sql
-- ВНИМАНИЕ: Это удалит ВСЕ черновики!

DROP TRIGGER IF EXISTS trigger_update_draft_last_saved ON tournament_drafts;
DROP FUNCTION IF EXISTS update_draft_last_saved();
DROP FUNCTION IF EXISTS cleanup_expired_drafts();
DROP POLICY IF EXISTS drafts_user_isolation ON tournament_drafts;
DROP TABLE IF EXISTS tournament_drafts CASCADE;

-- Проверка отката
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'tournament_drafts'
);
-- Ожидаемый результат: false
```

---

## 🛠️ АВТОМАТИЧЕСКАЯ ОЧИСТКА

Рекомендуется настроить автоматическую очистку устаревших черновиков:

### Вариант 1: Cron задача на сервере

```bash
# Открываем crontab
crontab -e

# Добавляем задачу (запуск каждый день в 3:00)
0 3 * * * sudo -u postgres psql -d tournament_db -c "SELECT cleanup_expired_drafts();" >> /var/log/drafts_cleanup.log 2>&1
```

### Вариант 2: PostgreSQL pg_cron (если установлен)

```sql
-- Создаем расписание
SELECT cron.schedule(
    'cleanup-drafts-daily',
    '0 3 * * *',
    'SELECT cleanup_expired_drafts();'
);
```

---

## 📊 МОНИТОРИНГ

### Полезные запросы для мониторинга:

```sql
-- Статистика по черновикам
SELECT 
    COUNT(*) as total_drafts,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(current_step) as avg_step,
    COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_count
FROM tournament_drafts;

-- Топ пользователей по черновикам
SELECT 
    u.username,
    COUNT(td.id) as draft_count,
    MAX(td.last_saved_at) as last_activity
FROM tournament_drafts td
JOIN users u ON u.id = td.user_id
GROUP BY u.username
ORDER BY draft_count DESC
LIMIT 10;

-- Распределение по шагам
SELECT 
    current_step,
    COUNT(*) as count
FROM tournament_drafts
GROUP BY current_step
ORDER BY current_step;
```

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Безопасность:** Включен Row Level Security - пользователи видят только свои черновики
2. **Срок хранения:** Черновики автоматически удаляются через 7 дней
3. **Автосохранение:** Wizard сохраняет черновик каждые 30 секунд
4. **Производительность:** Индексы обеспечивают быстрый доступ к черновикам

---

## 🔗 СВЯЗАННЫЕ ФАЙЛЫ

- **Backend API:** `backend/routes/tournament-drafts.js`
- **Frontend Wizard:** `frontend/src/pages/create-tournament/CreateTournamentWizard.js`
- **SQL миграция:** `backend/migrations/20251003_create_tournament_drafts.sql`

---

**Миграция готова к применению!** ✅

