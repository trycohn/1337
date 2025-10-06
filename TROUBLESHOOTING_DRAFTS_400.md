# 🔧 TROUBLESHOOTING: 400 Bad Request на /api/tournaments/drafts

**Проблема:** GET /api/tournaments/drafts возвращает 400 вместо списка черновиков

**Причина:** Row Level Security блокирует запросы из-за отсутствия `current_setting('app.current_user_id')`

---

## 🚀 БЫСТРОЕ ИСПРАВЛЕНИЕ

### На VDS выполните:

```bash
# 1. Подключение
ssh root@80.87.200.23

# 2. Переход в проект
cd /var/www/1337community.com/

# 3. Получение последних изменений (включая фикс RLS)
git pull origin main

# 4. Применение миграции исправления RLS
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_fix_drafts_rls.sql

# 5. Проверка что таблица существует
sudo -u postgres psql -d tournament_db -c "\d tournament_drafts"

# 6. Проверка что RLS отключен
sudo -u postgres psql -d tournament_db -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'tournament_drafts';"
# Ожидается: rowsecurity = f (FALSE)

# 7. Перезапуск backend
pm2 restart 1337-backend

# 8. Проверка логов
pm2 logs 1337-backend --lines 30
```

---

## 🔍 ДИАГНОСТИКА ПРОБЛЕМЫ

### Проверить логи backend:

```bash
pm2 logs 1337-backend --err --lines 50 | grep -i draft
```

**Возможные ошибки:**

```
1. "relation 'tournament_drafts' does not exist"
   → Миграция не применена
   → Применить: 20251003_create_tournament_drafts.sql

2. "permission denied for table tournament_drafts"
   → RLS блокирует доступ
   → Применить: 20251003_fix_drafts_rls.sql

3. "column 'user_id' does not exist"
   → Проблема со структурой таблицы
   → Пересоздать таблицу

4. "unrecognized configuration parameter 'app.current_user_id'"
   → RLS настроен, но middleware не устанавливает параметр
   → Отключить RLS (наша миграция)
```

---

## 📋 МИГРАЦИИ В ПРАВИЛЬНОМ ПОРЯДКЕ

```bash
# Если вы еще не применяли миграции, выполните по порядку:

# 1. Создание таблицы черновиков
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_create_tournament_drafts.sql

# 2. Исправление RLS (отключение)
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_fix_drafts_rls.sql

# 3. Формат финалов
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_add_final_match_format.sql

# 4. Шаблоны турниров
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_create_tournament_templates.sql
```

---

## 🧪 ТЕСТИРОВАНИЕ ПОСЛЕ ИСПРАВЛЕНИЯ

### Проверка API:

```bash
# На VDS или локально
# Замените YOUR_TOKEN на реальный JWT токен из localStorage

curl -X GET "http://localhost:3000/api/tournaments/drafts" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Ожидаемый результат (если нет черновиков):
{
  "success": true,
  "drafts": []
}

# Ожидаемый результат (если есть черновики):
{
  "success": true,
  "drafts": [
    {
      "id": 1,
      "draft_data": {...},
      "current_step": 3,
      ...
    }
  ]
}
```

### В браузере:

```
1. Открыть DevTools → Network
2. Перейти на /create
3. Найти запрос: GET /api/tournaments/drafts
4. Проверить:
   - Status: 200 OK (не 400)
   - Response: {"success": true, "drafts": [...]}
```

---

## 🔧 АЛЬТЕРНАТИВНОЕ ИСПРАВЛЕНИЕ

### Если хотите сохранить RLS (более безопасно):

Нужно добавить middleware для установки `app.current_user_id`:

```javascript
// backend/routes/tournament-drafts.js

// Добавить middleware перед всеми роутами
router.use(authenticateToken);

// Middleware для установки user context
router.use(async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      await pool.query(`SET LOCAL app.current_user_id = ${req.user.id}`);
    } catch (err) {
      console.error('Ошибка установки user context:', err);
    }
  }
  next();
});

// Затем идут роуты...
router.get('/drafts', async (req, res) => {
  // RLS автоматически фильтрует по user_id
  const result = await pool.query('SELECT * FROM tournament_drafts');
  // ...
});
```

**НО:** Это сложнее и требует транзакций. 

**Рекомендую:** Использовать простое решение (отключить RLS, фильтровать WHERE user_id = $1)

---

## ✅ БЫСТРОЕ РЕШЕНИЕ (РЕКОМЕНДУЮ)

```bash
# Одна команда на VDS:
ssh root@80.87.200.23 "cd /var/www/1337community.com/ && \
git pull origin main && \
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_fix_drafts_rls.sql && \
pm2 restart 1337-backend && \
echo '✅ RLS отключен, API должен работать!'"
```

После этого проверьте в браузере - ошибка 400 должна исчезнуть.

---

## 📝 ЧТО ДЕЛАЕТ ИСПРАВЛЕНИЕ

```
ДО:
- RLS включен
- Политика требует current_setting('app.current_user_id')
- Middleware не устанавливает этот параметр
→ Ошибка 400

ПОСЛЕ:
- RLS отключен
- Фильтрация на уровне SQL: WHERE user_id = $1
- req.user.id из JWT токена
→ Работает корректно ✅
```

---

**ИСПРАВЛЕНИЕ ГОТОВО!**

Примените миграцию `20251003_fix_drafts_rls.sql` на VDS и ошибка исчезнет. 🔧
