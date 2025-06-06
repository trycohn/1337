# 🚀 Инструкции по развертыванию обновлений на VDS

## 📋 **ЧТО БЫЛО ДОБАВЛЕНО:**

### ✅ **Основное исправление:**
- **Проблема**: В блоке "Призеры турнира" ничего не отображалось для завершенных турниров
- **Решение**: Добавлена система динамического определения призеров + каждый участник команды теперь призер

### 🎯 **Новая особенность:**
- **Индивидуальные призеры**: Каждый участник команды-победителя получает статус призера
- **Статистика**: Правильный учет всех участников команды в базе данных

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
sudo -u postgres psql -c "\d tournaments" your_database_name
sudo -u postgres psql -c "\d user_tournament_stats" your_database_name
```

## ✅ **ПРОВЕРКА ФУНКЦИОНАЛА:**

1. **Откройте завершенный турнир** на сайте
2. **Проверьте блок "Призеры турнира"** - должен отображаться с подиумом
3. **Для командных турниров** - проверьте, что каждый участник команды показан как призер
4. **Кликните по именам игроков** - должны вести на профили

## 🚨 **В СЛУЧАЕ ПРОБЛЕМ:**

### Если призеры не отображаются:
```bash
# Проверьте консоль браузера на ошибки JavaScript
# Проверьте логи backend на ошибки API
pm2 logs 1337-backend --lines 50
```

### Если ошибка миграции:
```bash
# Проверьте, применилась ли миграция
sudo -u postgres psql your_database_name -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name IN ('winner_id', 'winner_name');"
```

### Если 500 ошибка сервера:
```bash
# Проверьте логи Nginx и backend
tail -f /var/log/nginx/error.log
pm2 logs 1337-backend --lines 20
```

## 📁 **ОСНОВНЫЕ ИЗМЕНЕННЫЕ ФАЙЛЫ:**

- `backend/routes/tournaments.js` - ✅ Обновлен
- `database/migrations/add_tournament_winners.sql` - ✅ Новый файл  
- `frontend/src/components/TournamentDetails.js` - ✅ Обновлен
- `frontend/src/components/TournamentDetails.css` - ✅ Обновлен

## 🎯 **ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:**

После развертывания пользователи увидят:
- ✅ **Блок призеров** отображается для всех завершенных турниров
- ✅ **Каждый участник команды** показан как индивидуальный призер с медалью
- ✅ **Ссылки на профили** работают корректно
- ✅ **Красивые анимации** и стили для призеров

---

📞 **Поддержка**: Если возникли проблемы, проверьте файл `individual_winners_update.md` для детального описания изменений. 