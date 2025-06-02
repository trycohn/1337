# 🚀 Инструкция по обновлению сервера

## Проблема
Backend не запускается из-за отсутствующих зависимостей `redis` и `ws`.

## Решение

### 1. Подключитесь к серверу
```bash
ssh root@1337community.com
```

### 2. Перейдите в директорию проекта
```bash
cd /var/www/1337community.com
```

### 3. Обновите код с GitHub
```bash
git pull origin main
```

### 4. Установите недостающие зависимости
```bash
cd backend
npm install redis@^4.6.0 ws@^8.18.0
```

### 5. Проверьте package.json
```bash
cat package.json | grep -E "(redis|ws)"
```
Должно показать:
```
"redis": "^4.6.0",
"ws": "^8.18.0"
```

### 6. Перезапустите backend
```bash
pm2 restart 1337-backend
```

### 7. Проверьте статус
```bash
pm2 status
pm2 logs 1337-backend --lines 20
```

### 8. Проверьте работу API
```bash
curl -X GET https://1337community.com/testdb
```

## Что исправлено

✅ **Добавлены недостающие зависимости** в package.json:
- `redis@^4.6.0` - для кэширования real-time статистики
- `ws@^8.18.0` - для WebSocket соединений

✅ **Graceful fallback** для V4 сервисов:
- Если Redis недоступен - работает без кэширования
- Если WebSocket недоступен - работает без real-time обновлений
- Если система достижений недоступна - работает без достижений

✅ **Улучшенная обработка ошибок**:
- Опциональные импорты с try/catch
- Fallback на базовую статистику
- Подробные логи для диагностики

## Ожидаемый результат

После выполнения инструкций:
- ✅ Backend запустится без ошибок
- ✅ V4 функции будут работать в базовом режиме
- ✅ Основная функциональность сайта будет доступна
- ✅ Вкладка "Турниры" появится в профиле

## Дополнительно (опционально)

Если хотите полную функциональность V4:

### Установка Redis (для кэширования)
```bash
# Ubuntu/Debian
apt update && apt install redis-server
systemctl start redis-server
systemctl enable redis-server

# Проверка
redis-cli ping
```

### Настройка переменных окружения
Добавьте в `.env`:
```
REDIS_HOST=localhost
REDIS_PORT=6379
```

После этого перезапустите backend:
```bash
pm2 restart 1337-backend
``` 