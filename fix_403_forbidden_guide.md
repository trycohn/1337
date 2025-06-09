# 🚨 ИСПРАВЛЕНИЕ 403 FORBIDDEN - ПОШАГОВОЕ РУКОВОДСТВО

## 🔍 **Диагностика проблемы**

Сайт выдает `403 Forbidden`, что означает что Nginx не может получить доступ к статическим файлам frontend.

### **1. Проверьте конфигурацию Nginx:**

```bash
# Подключитесь к серверу
ssh root@80.87.200.23

# Проверьте текущую конфигурацию
cat /etc/nginx/sites-available/1337community.com

# Или проверьте активную конфигурацию
nginx -T | grep -A 30 "server_name 1337community.com"
```

### **2. Проверьте файлы frontend:**

```bash
# Проверьте существует ли папка build
ls -la /var/www/1337community.com/frontend/build/

# Проверьте права доступа
ls -la /var/www/1337community.com/frontend/

# Проверьте есть ли index.html
ls -la /var/www/1337community.com/frontend/build/index.html
```

### **3. Проверьте логи Nginx:**

```bash
# Посмотрите последние ошибки
tail -10 /var/log/nginx/error.log

# Тестируйте доступ к сайту
curl -I https://1337community.com/
```

## 🛠️ **РЕШЕНИЯ ПО ПРИОРИТЕТУ**

### **🎯 РЕШЕНИЕ 1: Пересоберите frontend (НАИБОЛЕЕ ВЕРОЯТНО)**

Возможно frontend не собран или папка build пустая:

```bash
cd /var/www/1337community.com/frontend

# Проверьте package.json
cat package.json | grep -A 5 '"scripts"'

# Установите зависимости
npm install

# Соберите production build
npm run build

# Проверьте что build создался
ls -la build/
ls -la build/index.html
```

### **🎯 РЕШЕНИЕ 2: Исправьте конфигурацию Nginx**

Замените содержимое `/etc/nginx/sites-available/1337community.com`:

```bash
# Создайте backup
cp /etc/nginx/sites-available/1337community.com /etc/nginx/sites-available/1337community.com.backup.$(date +%Y%m%d_%H%M%S)

# Замените конфигурацию на правильную
cat > /etc/nginx/sites-available/1337community.com << 'EOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name 1337community.com www.1337community.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl;
    server_name 1337community.com www.1337community.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/1337community.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/1337community.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # КРИТИЧЕСКИ ВАЖНО: правильный root для frontend
    root /var/www/1337community.com/frontend/build;
    index index.html;

    # Frontend static files - главное location
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO endpoints
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific settings
        proxy_buffering off;
        proxy_cache off;
        proxy_connect_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
    }

    # Test endpoint
    location /test-socketio {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Проверьте синтаксис
nginx -t

# Если OK, перезагрузите Nginx
systemctl reload nginx
```

### **🎯 РЕШЕНИЕ 3: Исправьте права доступа**

```bash
# Установите правильные права для веб-сервера
chown -R www-data:www-data /var/www/1337community.com/frontend/build/
chmod -R 755 /var/www/1337community.com/frontend/build/

# Проверьте что права установлены
ls -la /var/www/1337community.com/frontend/build/
```

### **🎯 РЕШЕНИЕ 4: Проверьте nginx.conf**

Возможно отсутствует include sites-enabled:

```bash
# Проверьте что в nginx.conf есть include
grep -n "include.*sites-enabled" /etc/nginx/nginx.conf

# Если отсутствует, добавьте в http блок
sed -i '/^http {/,/^}$/{/^}$/i\    include /etc/nginx/sites-enabled/*;}' /etc/nginx/nginx.conf

# Проверьте синтаксис и перезагрузите
nginx -t && systemctl reload nginx
```

## 🧪 **ТЕСТИРОВАНИЕ РЕЗУЛЬТАТОВ**

После применения любого решения, протестируйте:

```bash
# 1. Проверьте статус Nginx
systemctl status nginx

# 2. Проверьте что порты слушают
ss -tlnp | grep nginx

# 3. Тестируйте доступ к сайту
curl -I https://1337community.com/

# 4. Проверьте API backend
curl -I https://1337community.com/api/users/me

# 5. Проверьте Socket.IO
curl https://1337community.com/test-socketio
```

### **✅ Ожидаемые результаты:**

1. **Frontend**: `HTTP/1.1 200 OK` + HTML контент
2. **API**: `HTTP/1.1 401 Unauthorized` (нормально без токена)
3. **Socket.IO**: `{"status":"success", ...}`

## 🚨 **БЫСТРОЕ ИСПРАВЛЕНИЕ (если спешите)**

Выполните эти команды по порядку:

```bash
ssh root@80.87.200.23
cd /var/www/1337community.com/frontend
npm run build
chown -R www-data:www-data build/
systemctl reload nginx
curl -I https://1337community.com/
```

Если по-прежнему 403, тогда проблема в конфигурации Nginx - применяйте **РЕШЕНИЕ 2**.

## 📋 **ОБНОВЛЕНИЕ ЛОГА ИЗМЕНЕНИЙ**

После успешного исправления добавьте в changes.md:

```markdown
## 🔧 [2025-01-30] ИСПРАВЛЕНА ОШИБКА 403 FORBIDDEN ✅
**Проблема**: Сайт возвращал 403 Forbidden на главную страницу
**Причина**: [укажите найденную причину]
**Решение**: [укажите примененное решение]
**Результат**: Сайт полностью восстановлен и доступен
```

## 🎯 **ПРОФИЛАКТИКА**

Чтобы избежать подобных проблем в будущем:

1. **Всегда делайте backup** конфигураций перед изменениями
2. **Проверяйте build** после изменений frontend
3. **Мониторьте логи** Nginx регулярно
4. **Тестируйте** доступ к сайту после применения исправлений 