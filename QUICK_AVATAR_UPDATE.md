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

## 🚨 Экстренное исправление (если аватар не обновился)

Если аватар не изменился в существующем чате, используйте экстренный скрипт:

```bash
# 1. Подключитесь к серверу
ssh root@your-server-ip

# 2. Перейдите в директорию проекта
cd /var/www/1337community

# 3. Запустите экстренное исправление
chmod +x fix_system_avatar_now.sh
./fix_system_avatar_now.sh
```

### Или вручную:

```bash
# 1. Перейдите в backend директорию
cd /var/www/1337community/backend

# 2. Запустите принудительное обновление
NODE_ENV=production node force_update_system_avatar.js

# 3. Перезапустите сервис
sudo systemctl restart 1337-backend
```

### Локально (Development):

```bash
# 1. Перейдите в директорию проекта
cd /path/to/1337community/backend

# 2. Запустите принудительное обновление
node force_update_system_avatar.js
```

## 📋 Что происходит

1. ✅ Обновляется код из GitHub
2. ✅ **Принудительно** устанавливается аватар `1337-logo-chat.png` для пользователя `1337community`
3. ✅ Обновляется поле `updated_at` для сброса кэша
4. ✅ Перезапускается сервис приложения
5. ✅ Проверяется доступность аватара

## 🔍 Проверка результата

1. Откройте чат на сайте
2. Найдите пользователя `1337community` 
3. У него должен отображаться логотип 1337
4. Если не обновился - очистите кэш браузера (Ctrl+F5) или откройте в режиме инкогнито

## 📞 Поддержка

При проблемах проверьте:
- Логи сервера: `tail -f /var/log/nginx/error.log`
- Статус сервиса: `systemctl status 1337-backend`
- Доступность файла: `curl -I https://1337community.com/uploads/avatars/1337-logo-chat.png`

## 🔧 Дополнительная диагностика

Проверить аватар в базе данных:
```sql
SELECT id, username, avatar_url, updated_at 
FROM users 
WHERE username = '1337community';
``` 