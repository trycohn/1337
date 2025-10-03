# 🚀 ДЕПЛОЙ: ОСОБЫЙ ФОРМАТ ДЛЯ ФИНАЛОВ

**Дата:** 3 октября 2025  
**Версия:** 4.27.0  
**Фичи:** Особый формат матчей финала + Исправление backend черновиков

---

## ✅ ЧТО ДОБАВЛЕНО

### Frontend:
1. ✅ **Step4_Rules (Wizard)** - чекбокс "Особый формат матчей финала" + выпадающее меню
2. ✅ **Step6_Preview (Wizard)** - отображение выбранного формата финала
3. ✅ **CreateTournamentManual** - аналогичная функция в ручной настройке
4. ✅ **ModeSelector** - вся карточка кликабельна (убраны кнопки)

### Backend:
1. ✅ **TournamentService.js** - поддержка final_match_format
2. ✅ **TournamentRepository.js** - сохранение в БД (lobby_match_format + final_match_format)
3. ✅ **tournament-drafts.js** - исправлен импорт middleware (authenticateToken)

### База данных:
1. ✅ **Миграция 20251003_add_final_match_format.sql:**
   - Добавлено поле `lobby_match_format` (если не было)
   - Добавлено поле `final_match_format`
   - Валидация значений (bo1, bo3, bo5)

---

## 🔧 ИНСТРУКЦИЯ ПО ДЕПЛОЮ

### Шаг 1: Подключение к VDS

```bash
ssh root@80.87.200.23
```

### Шаг 2: Переход в проект

```bash
cd /var/www/1337community.com/
```

### Шаг 3: Получение изменений из GitHub

```bash
git pull origin main
```

### Шаг 4: Применение миграций БД

```bash
# Миграция 1: Черновики турниров
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_create_tournament_drafts.sql

# Миграция 2: Формат финальных матчей
sudo -u postgres psql -d tournament_db -f backend/migrations/20251003_add_final_match_format.sql
```

### Шаг 5: Пересборка Frontend

```bash
cd frontend
npm run build
```

### Шаг 6: Копирование в Nginx

```bash
sudo cp -r build/* /var/www/html/1337community/
```

### Шаг 7: Перезапуск Backend

```bash
pm2 restart 1337-backend
```

### Шаг 8: Перезагрузка Nginx

```bash
sudo systemctl reload nginx
```

---

## ✅ ПРОВЕРКА РАБОТОСПОСОБНОСТИ

### 1. Проверка Backend

```bash
# Статус PM2
pm2 status

# Логи (должны быть без ошибок)
pm2 logs 1337-backend --lines 50

# Должно быть:
# ✅ Файл .env успешно загружен
# ✅ Backend сервер запущен на порту 3000
# БЕЗ: Error: Route.post() requires a callback function
```

### 2. Проверка БД

```bash
# Проверяем новые колонки
sudo -u postgres psql -d tournament_db -c "\d tournaments" | grep match_format

# Должно показать:
# lobby_match_format  | character varying(10) |
# final_match_format  | character varying(10) |
```

### 3. Проверка Frontend

Открыть в браузере: `https://1337community.com/create`

**Проверочный чек-лист:**

- [ ] Страница загружается без ошибок
- [ ] Показываются 2 кликабельные карточки (без кнопок)
- [ ] Клик на карточку "Мастер создания" → открывается Wizard
- [ ] Клик на карточку "Ручная настройка" → открывается старая форма
- [ ] В Wizard на шаге 4 (Правила) есть чекбокс "Особый формат матчей финала"
- [ ] При активации чекбокса появляется выпадающее меню с bo1/bo3/bo5
- [ ] На шаге 6 (Предпросмотр) отображается выбранный формат финала
- [ ] В ручной настройке есть та же функция (после "Формат матчей по умолчанию")
- [ ] Создание турнира работает без ошибок

---

## 🎯 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ

### Пример 1: Daily Cup с особым финалом

```
Формат матчей по умолчанию: BO1 (быстрые матчи)
✓ Особый формат матчей финала
  └─ Формат финальных матчей: BO3 (более серьезный финал)
```

**Результат:** Все матчи BO1, но финал, полуфинал и гранд-финал - BO3

### Пример 2: Weekly Championship

```
Формат матчей по умолчанию: BO3 (стандарт)
✓ Особый формат матчей финала
  └─ Формат финальных матчей: BO5 (эпичный финал)
```

**Результат:** Все матчи BO3, но финальные матчи - BO5

---

## 🔍 ДИАГНОСТИКА ПРОБЛЕМ

### Проблема 1: Backend не запускается

```bash
# Проверить логи
pm2 logs 1337-backend --err --lines 100

# Если ошибка "Route.post() requires a callback function":
# Проверить что в tournament-drafts.js используется authenticateToken
grep "const.*auth" backend/routes/tournament-drafts.js

# Должно быть:
# const { authenticateToken } = require('../middleware/auth');
```

### Проблема 2: Миграция не применяется

```bash
# Проверить подключение к БД
sudo -u postgres psql -d tournament_db -c "SELECT version();"

# Попробовать применить вручную
sudo -u postgres psql -d tournament_db

# В psql:
\i /var/www/1337community.com/backend/migrations/20251003_add_final_match_format.sql
```

### Проблема 3: Frontend не обновляется

```bash
# Очистить кэш Nginx
sudo systemctl restart nginx

# Проверить что build скопирован
ls -la /var/www/html/1337community/ | grep -i create

# Очистить кэш браузера (Ctrl+Shift+R)
```

---

## 📊 НОВЫЕ API ENDPOINTS

### Черновики турниров:

```bash
# Сохранить черновик
curl -X POST https://1337community.com/api/tournaments/drafts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"draft_data": {...}, "current_step": 3}'

# Получить черновики
curl -X GET https://1337community.com/api/tournaments/drafts \
  -H "Authorization: Bearer YOUR_TOKEN"

# Удалить черновик
curl -X DELETE https://1337community.com/api/tournaments/drafts/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 ВИЗУАЛЬНЫЕ ИЗМЕНЕНИЯ

### До (с кнопками):
```
┌─────────────────────┐
│  🧙 МАСТЕР          │
│  ...               │
│  [Использовать] ⭐  │
└─────────────────────┘
```

### После (вся карточка кликабельна):
```
┌─────────────────────┐
│  🧙 МАСТЕР          │ ← Вся карточка
│  ...               │   кликабельна
│  Нажмите для выбора →│
└─────────────────────┘
```

---

## 📈 МЕТРИКИ УСПЕХА

После деплоя отслеживайте:

1. **Использование Wizard** - % создания через Wizard vs Ручная
2. **Использование особого формата** - % турниров с final_match_format
3. **Bounce rate** - снижение на этапе создания
4. **Время создания** - среднее время до кнопки "Создать"
5. **Сохраненные черновики** - количество автосохранений

---

## 🆘 ОТКАТ (если что-то пошло не так)

### Откат миграций БД:

```sql
-- Откат формата финалов
ALTER TABLE tournaments DROP COLUMN IF EXISTS final_match_format;
ALTER TABLE tournaments DROP COLUMN IF EXISTS lobby_match_format;

-- Откат черновиков
DROP TABLE IF EXISTS tournament_drafts CASCADE;
```

### Откат кода:

```bash
# Вернуться на предыдущий коммит
git log --oneline -5
git checkout <previous_commit_hash>

# Пересобрать и задеплоить
cd frontend && npm run build
sudo cp -r build/* /var/www/html/1337community/
pm2 restart 1337-backend
```

---

## 📞 ПОДДЕРЖКА

**Файлы для дебага:**

Frontend:
- `frontend/src/pages/create-tournament/components/steps/Step4_Rules.js`
- `frontend/src/pages/create-tournament/CreateTournamentWizard.js`
- `frontend/src/pages/create-tournament/CreateTournamentManual.js`

Backend:
- `backend/routes/tournament-drafts.js`
- `backend/services/tournament/TournamentService.js`
- `backend/repositories/tournament/TournamentRepository.js`

Миграции:
- `backend/migrations/20251003_create_tournament_drafts.sql`
- `backend/migrations/20251003_add_final_match_format.sql`

---

**ГОТОВО К ДЕПЛОЮ!** ✅

Последовательность:
1. git pull
2. Применить обе миграции
3. npm run build
4. Копировать build
5. pm2 restart
6. Проверить работу

