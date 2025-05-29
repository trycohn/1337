# Быстрое развертывание исправления

## Проблема
Ошибка при приглашении участников: "Укажите никнейм или email"

## Быстрое исправление

### На сервере выполните:

```bash
# 1. Подключение к серверу
ssh root@your-server-ip

# 2. Переход в директорию проекта
cd /var/www/1337community

# 3. Получение обновлений
git pull origin main

# 4. Сборка frontend
cd frontend
npm run build

# 5. Перезапуск сервисов
sudo systemctl restart 1337-backend
sudo systemctl reload nginx

# 6. Проверка статуса
sudo systemctl status 1337-backend
```

### Проверка исправления:
1. Откройте https://1337community.com
2. Перейдите к турниру
3. Найдите пользователя через поиск
4. Нажмите "пригласить" - ошибка должна исчезнуть

### В случае проблем:
```bash
# Логи backend
sudo journalctl -u 1337-backend -f

# Логи nginx
sudo tail -f /var/log/nginx/error.log
```

## Что было исправлено
В файле `frontend/src/components/TournamentDetails.js` изменен параметр запроса с `user_id` на `username` в функции `handleInviteUser`. 