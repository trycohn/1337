# 🔒 Защита Match Configs от публичного доступа

## ✅ Что реализовано

JSON конфиги матчей (роут `/lobby/:lobbyId/:file.json`) теперь доступны **ТОЛЬКО** для CS2 серверов по IP из файла `.env`.

## 📋 Настройка на VDS

### 1. Добавить IP серверов в .env

```bash
# Подключаемся к серверу
ssh root@80.87.200.23

# Переходим в backend
cd /var/www/1337community.com/backend

# Редактируем .env (добавляем строку с IP через запятую)
nano .env
```

**Добавь в `.env`:**
```env
# IP адреса CS2 серверов (через запятую)
CS2_SERVER_IPS=80.87.200.23,95.123.45.67,192.168.1.100
```

**Примеры:**
- Один сервер: `CS2_SERVER_IPS=80.87.200.23`
- Несколько серверов: `CS2_SERVER_IPS=80.87.200.23,95.123.45.67,192.168.1.100`

### 2. Обновить код и перезапустить

```bash
cd /var/www/1337community.com

# Пулим изменения
git pull origin main

# Перезапускаем backend
pm2 restart 1337-backend

# Смотрим логи
pm2 logs 1337-backend --lines 50
```

## 🧪 Тестирование

### ❌ Доступ с неизвестного IP (должен вернуть 403)
```bash
curl https://1337community.com/lobby/123/test.json
# Ответ: {"error":"Access denied","message":"Only authorized CS2 servers can access match configs"}
```

### ✅ Доступ с IP сервера (автоматически работает)
Когда CS2 сервер запрашивает конфиг через `matchzy_loadmatch_url`, запрос идет с его IP, указанного в `.env`.

## 📝 Логи

При каждом запросе к `/lobby` в логах будет:
```
🔍 [ServerAuth] Проверка IP: 80.87.200.23
🔍 [ServerAuth] Разрешенные IPs: 80.87.200.23, 127.0.0.1, ::1, localhost
✅ [ServerAuth] Доступ разрешен для IP: 80.87.200.23
```

Или при запрете:
```
⛔ [ServerAuth] Доступ запрещен для IP: 192.168.1.100
```

## 🔧 Добавление новых CS2 серверов

Чтобы новый сервер мог получать доступ к конфигам, просто добавь его IP в `.env`:

```bash
# Редактируем .env
nano /var/www/1337community.com/backend/.env

# Добавляем IP через запятую
CS2_SERVER_IPS=80.87.200.23,НОВЫЙ_IP_СЕРВЕРА

# Перезапускаем backend
pm2 restart 1337-backend
```

**Готово!** Без SQL, без БД - просто файл.

