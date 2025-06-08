# Инструкция по исправлению WebSocket на VDS

## Проблема
WebSocket соединения падают с ошибкой 400 Bad Request при попытке upgrade соединения.

## Шаги для исправления

### 1. Подключитесь к серверу
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Перейдите в директорию проекта
```bash
cd /var/www/1337community.com
```

### 3. Скопируйте скрипты диагностики и исправления
Создайте файл `fix_websocket_issue.sh`:
```bash
nano fix_websocket_issue.sh
# Вставьте содержимое скрипта диагностики
chmod +x fix_websocket_issue.sh
```

Создайте файл `apply_websocket_fix.sh`:
```bash
nano apply_websocket_fix.sh
# Вставьте содержимое скрипта исправления
chmod +x apply_websocket_fix.sh
```

### 4. Запустите диагностику
```bash
./fix_websocket_issue.sh
```

Сохраните вывод для анализа.

### 5. Примените исправления
```bash
./apply_websocket_fix.sh
```

### 6. Проверьте результат
После применения исправлений:

1. Откройте https://1337community.com в браузере
2. Откройте консоль разработчика (F12)
3. Перейдите на вкладку Network
4. Найдите WebSocket соединения (фильтр WS)
5. Убедитесь, что соединение установлено (статус 101)

### 7. Дополнительная проверка
```bash
# Проверьте статус сервисов
systemctl status nginx
pm2 status 1337-backend

# Проверьте логи
pm2 logs 1337-backend --lines 50
tail -f /var/log/nginx/error.log
```

## Что делают исправления

1. **Обновляют конфигурацию nginx**:
   - Правильная настройка proxy для WebSocket
   - Отключение буферизации
   - Увеличение таймаутов
   - Добавление CORS заголовков

2. **Добавляют map директиву**:
   - Необходима для правильного upgrade соединения
   - Определяет значение заголовка Connection

3. **Перезапускают сервисы**:
   - nginx для применения новой конфигурации
   - backend для сброса соединений

## Если проблема сохраняется

1. Проверьте, что backend слушает на порту 3000:
   ```bash
   netstat -tlnp | grep :3000
   ```

2. Проверьте конфигурацию Socket.IO в backend:
   ```bash
   grep -A 10 "const io = new Server" /var/www/1337community.com/backend/server.js
   ```

3. Убедитесь, что в server.js есть правильный path:
   ```javascript
   const io = new Server(server, {
     cors: {
       origin: process.env.FRONTEND_URL || "https://1337community.com",
       credentials: true
     },
     path: '/socket.io/'  // Важно!
   });
   ```

4. Проверьте firewall:
   ```bash
   ufw status
   ```

## Контакты для помощи
Если проблема не решается, сохраните все логи и вывод диагностики. 