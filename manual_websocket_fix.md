# 🔧 Ручное исправление WebSocket для 1337community.com

## 📋 Пошаговая инструкция

### 1. Подключитесь к серверу:
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Проверьте наличие map директивы:
```bash
grep -n "map.*http_upgrade" /etc/nginx/nginx.conf
```

Если не найдено, добавьте перед `http {`:
```bash
nano /etc/nginx/nginx.conf
```

Добавьте эти строки ПЕРЕД `http {`:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

### 3. Проверьте конфигурацию сайта:
```bash
nano /etc/nginx/sites-available/1337community.com
```

Убедитесь что:
- `listen 443 ssl;` (БЕЗ http2)
- location /socket.io/ идет ПЕРВЫМ
- Есть все необходимые заголовки

### 4. Проверьте синтаксис:
```bash
nginx -t
```

### 5. Перезагрузите nginx:
```bash
systemctl reload nginx
```

### 6. Перезапустите backend:
```bash
cd /var/www/1337community.com/backend
pm2 restart 1337-backend
```

### 7. Проверьте результат:
```bash
# Тест polling
curl -s https://1337community.com/socket.io/?EIO=4&transport=polling | head -c 50

# Проверка портов
ss -tlnp | grep nginx
```

## 🔍 Что должно быть в конфигурации nginx:

```nginx
# В /etc/nginx/nginx.conf (перед http {)
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# В /etc/nginx/sites-available/1337community.com
server {
    listen 443 ssl; # БЕЗ http2!
    server_name 1337community.com www.1337community.com;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        # ... остальные заголовки
    }
}
```

## ❗ Важно:
- HTTP/2 должен быть отключен для WebSocket
- Map директива должна быть в основном nginx.conf
- location /socket.io/ должен идти первым 