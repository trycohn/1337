# Быстрое обновление аватара системного пользователя 1337community

## 🚀 Быстрый старт

### На VDS сервере (Production):

```bash
# 1. Подключитесь к серверу
ssh root@your-server-ip

# 2. Перейдите в директорию проекта
cd /var/www/1337community

# 3. Обновите код и запустите скрипт
git pull origin main
chmod +x update_system_avatar.sh
./update_system_avatar.sh
```

### Локально (Development):

```bash
# 1. Перейдите в директорию проекта
cd /path/to/1337community

# 2. Запустите тестовый скрипт
node test_system_avatar.js
```

## 📋 Что происходит

1. ✅ Обновляется код из GitHub
2. ✅ Устанавливается аватар `1337-logo-chat.png` для пользователя `1337community`
3. ✅ Перезапускается сервис приложения
4. ✅ Проверяется доступность аватара

## 🔍 Проверка результата

Откройте чат на сайте и найдите пользователя `1337community` - у него должен отображаться логотип 1337.

## 📞 Поддержка

При проблемах проверьте:
- Логи сервера: `tail -f /var/log/nginx/error.log`
- Статус сервиса: `systemctl status 1337-backend`
- Доступность файла: `curl -I https://1337community.com/uploads/avatars/1337-logo-chat.png` 