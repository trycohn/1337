# 🚨 БЫСТРОЕ ИСПРАВЛЕНИЕ ПРОБЛЕМЫ С 1337-BACKEND

## Проблема
Ошибка 502 (Bad Gateway) при авторизации на https://1337community.com

## ⚡ СРОЧНОЕ РЕШЕНИЕ

Выполните эти команды **на вашем VDS сервере**:

### 1. Подключитесь к серверу
```bash
ssh root@your-server-ip
# или
ssh username@1337community.com
```

### 2. Быстрая диагностика
```bash
# Проверяем статус сервиса
sudo systemctl status 1337-backend

# Проверяем порты
sudo lsof -i :3000

# Проверяем процессы Node.js
ps aux | grep node
```

### 3. Быстрое исправление
```bash
# Перезапускаем сервис
sudo systemctl restart 1337-backend

# Ждем 5 секунд
sleep 5

# Перезагружаем Nginx
sudo systemctl reload nginx

# Тестируем API
curl -X GET http://localhost:3000/api/tournaments
```

### 4. Если сервис не существует
```bash
# Создаем сервис одной командой
sudo tee /etc/systemd/system/1337-backend.service > /dev/null <<EOF
[Unit]
Description=1337 Community Backend Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/1337community.com/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Запускаем
sudo systemctl daemon-reload
sudo systemctl enable 1337-backend
sudo systemctl start 1337-backend
```

### 5. Проверяем результат
```bash
# Статус сервиса
sudo systemctl status 1337-backend

# Тестируем сайт
curl -X GET https://1337community.com/api/tournaments
```

## 🔧 АВТОМАТИЧЕСКАЯ НАСТРОЙКА

Если хотите полную автоматическую настройку, скачайте и запустите скрипт:

```bash
# Скачиваем скрипт
wget https://raw.githubusercontent.com/your-repo/setup-1337-backend.sh

# Делаем исполняемым
chmod +x setup-1337-backend.sh

# Запускаем
sudo ./setup-1337-backend.sh
```

## 📋 ПРОВЕРОЧНЫЙ СПИСОК

После выполнения команд проверьте:

- [ ] `sudo systemctl status 1337-backend` - сервис активен
- [ ] `sudo lsof -i :3000` - порт 3000 занят
- [ ] `curl http://localhost:3000/api/tournaments` - API отвечает
- [ ] Авторизация на сайте работает

## 🆘 ЕСЛИ НЕ ПОМОГЛО

1. **Проверьте логи:**
   ```bash
   sudo journalctl -u 1337-backend -f
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Запустите вручную для отладки:**
   ```bash
   cd /var/www/1337community.com/backend
   sudo -u www-data node server.js
   ```

3. **Проверьте базу данных:**
   ```bash
   sudo systemctl status postgresql
   ```

## 📞 КОНТАКТЫ

Если проблема не решается, предоставьте вывод команд:
- `sudo systemctl status 1337-backend`
- `sudo journalctl -u 1337-backend -n 50`
- `sudo tail -n 20 /var/log/nginx/error.log`

---

**Время выполнения:** 2-5 минут  
**Требуется:** SSH доступ к серверу с правами sudo 