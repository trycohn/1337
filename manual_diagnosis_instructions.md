# Инструкция по ручной диагностике WebSocket

## Шаги диагностики:

### 1. Подключитесь к серверу
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Перейдите в директорию проекта
```bash
cd /var/www/1337community.com
```

### 3. Создайте и запустите диагностический скрипт
```bash
nano quick_websocket_diagnosis.sh
```

Скопируйте содержимое файла `quick_websocket_diagnosis.sh` и вставьте в nano.
Сохраните: Ctrl+X, затем Y, затем Enter.

```bash
chmod +x quick_websocket_diagnosis.sh
./quick_websocket_diagnosis.sh
```

### 4. Альтернативно - выполните команды вручную:

```bash
# Проверка nginx
systemctl status nginx
ss -tlnp | grep nginx

# Проверка backend
ss -tlnp | grep :3000
pm2 list

# Проверка конфигурации
grep -A 10 "location /socket.io/" /etc/nginx/sites-available/1337community.com
grep "map.*http_upgrade" /etc/nginx/nginx.conf

# Тест endpoints
curl -s http://localhost:3000/socket.io/?EIO=4&transport=polling
curl -s https://1337community.com/socket.io/?EIO=4&transport=polling

# Логи ошибок
tail -20 /var/log/nginx/error.log
pm2 logs 1337-backend --lines 10
```

### 5. Результаты отправьте для анализа

Скопируйте вывод диагностики для дальнейшего анализа проблемы. 