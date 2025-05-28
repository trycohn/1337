# Инструкция по обновлению проекта на сервере

## Исправление отображения статуса турниров

### Описание изменений
Исправлена проблема отображения статуса турнира "Идет" в списке турниров. Ранее турниры со статусом `in_progress` отображались как "Завершен", теперь корректно показываются как "Идет".

### Измененные файлы
- `frontend/src/components/TournamentsList.js` - исправлена логика отображения статусов
- `frontend/src/components/Home.css` - добавлен CSS стиль для статуса "in-progress"

### Команды для обновления на сервере

1. **Подключение к серверу по SSH:**
```bash
ssh username@your-server-ip
```

2. **Переход в директорию проекта:**
```bash
cd /path/to/your/project
```

3. **Получение последних изменений из GitHub:**
```bash
git pull origin main
```

4. **Проверка изменений:**
```bash
git log --oneline -5
```

5. **Если используется Docker, пересборка контейнеров:**
```bash
docker-compose down
docker-compose build --no-cache frontend
docker-compose up -d
```

6. **Если используется PM2 для Node.js:**
```bash
# Для фронтенда (если есть build процесс)
cd frontend
npm run build
cd ..

# Перезапуск приложения
pm2 restart all
```

7. **Если используется Nginx, перезагрузка конфигурации:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

8. **Проверка статуса сервисов:**
```bash
# Проверка Docker контейнеров
docker-compose ps

# Или проверка PM2 процессов
pm2 status

# Проверка Nginx
sudo systemctl status nginx
```

### Проверка исправления

1. Откройте страницу списка турниров в браузере
2. Убедитесь, что турниры со статусом "Идет" отображаются корректно
3. Проверьте как табличное, так и карточное представление

### Возможные проблемы и решения

**Проблема:** Изменения не отображаются в браузере
**Решение:** Очистите кеш браузера (Ctrl+F5) или используйте режим инкогнито

**Проблема:** Ошибки при git pull
**Решение:** 
```bash
git stash
git pull origin main
git stash pop
```

**Проблема:** Конфликты при слиянии
**Решение:**
```bash
git status
# Разрешите конфликты в указанных файлах
git add .
git commit -m "Resolve merge conflicts"
```

### Мониторинг

После обновления рекомендуется проверить логи:

```bash
# Логи Docker
docker-compose logs -f frontend

# Логи PM2
pm2 logs

# Логи Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Откат изменений (если необходимо)

Если возникли проблемы, можно откатить изменения:

```bash
git log --oneline -10
git reset --hard PREVIOUS_COMMIT_HASH
# Затем перезапустить сервисы
```

### Контакты для поддержки

При возникновении проблем обратитесь к администратору сервера или разработчику проекта. 