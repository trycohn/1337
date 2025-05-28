# Быстрое обновление сервера

## Исправление статуса турниров "Идет"

### Краткие команды для обновления:

```bash
# 1. Подключение к серверу
ssh username@your-server-ip

# 2. Переход в директорию проекта
cd /path/to/your/project

# 3. Обновление кода
git pull origin main

# 4. Если используется Docker:
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d

# 5. Если используется PM2:
cd frontend && npm run build && cd ..
pm2 restart all

# 6. Проверка статуса
docker-compose ps  # для Docker
# или
pm2 status  # для PM2
```

### Автоматическое обновление:

```bash
# Использовать готовый скрипт
./update_server.sh
```

### Что исправлено:
- Турниры со статусом `in_progress` теперь отображаются как "Идет" вместо "Завершен"
- Добавлен CSS стиль для статуса "in-progress"
- Исправлена логика в табличном и карточном представлении

### Проверка:
1. Откройте `/tournaments` в браузере
2. Убедитесь, что активные турниры показывают правильный статус 