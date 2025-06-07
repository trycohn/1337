# 🔍 РУЧНАЯ ДИАГНОСТИКА WEBSOCKET ПРОБЛЕМ

## 📋 Инструкции для выполнения на VDS сервере

### 1. Подключение к серверу:
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Переход в папку проекта:
```bash
cd /var/www/1337community.com
```

### 3. Обновление кода:
```bash
git pull origin main
```

### 4. Запуск диагностики:
```bash
chmod +x websocket_debug_commands.sh
./websocket_debug_commands.sh
```

---

## 🎯 АЛЬТЕРНАТИВНЫЕ КОМАНДЫ ДИАГНОСТИКИ

Если скрипт не работает, выполните команды по отдельности:

### Проверка PM2:
```bash
pm2 status
pm2 logs 1337-backend --lines 10
```

### Проверка HTTP API:
```bash
curl -s https://1337community.com/test-socketio
curl -s -I https://1337community.com/socket.io/
```

### Проверка Nginx:
```bash
systemctl status nginx
nginx -t
cat /etc/nginx/sites-available/1337community.com | grep -A 10 socket.io
```

### Проверка портов:
```bash
lsof -i :3000
lsof -i :80
lsof -i :443
```

### Проверка логов:
```bash
tail -20 /var/log/nginx/error.log
tail -20 /var/log/nginx/access.log | grep socket
```

---

## 🔧 ВОЗМОЖНЫЕ ПРОБЛЕМЫ И РЕШЕНИЯ

### Проблема 1: Socket.IO endpoint возвращает HTML вместо JSON
**Причина**: Nginx неправильно проксирует запросы  
**Решение**: Проверить и исправить конфигурацию Nginx

### Проблема 2: Connection refused на порту 3000
**Причина**: Backend не запущен или не слушает порт 3000  
**Решение**: Перезапустить PM2 процесс

### Проблема 3: SSL/HTTPS проблемы с WebSocket
**Причина**: Неправильная настройка SSL для WebSocket  
**Решение**: Проверить SSL сертификаты и настройки

### Проблема 4: Socket.IO server не инициализируется
**Причина**: Ошибки в backend коде  
**Решение**: Проверить логи PM2 на ошибки

---

## 📤 ОТПРАВКА РЕЗУЛЬТАТОВ

После выполнения диагностики отправьте результаты для анализа и исправления проблемы.

**Важно**: Включите полные выводы команд, особенно ошибки и статусы сервисов. 