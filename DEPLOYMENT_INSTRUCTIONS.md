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

# Инструкции по исправлению ошибки журнала событий турнира

## Проблема
При открытии вкладки "Журнал событий" в турнире возникает ошибка 500, так как таблица `tournament_logs` не существует в базе данных.

## Решение
Необходимо создать таблицу `tournament_logs` в базе данных на продакшн сервере.

## Шаги по исправлению

### 1. Подключение к серверу
```bash
ssh your-username@1337community.com
```

### 2. Переход в папку проекта
```bash
cd /path/to/your/project/1337
```

### 3. Применение миграции базы данных

#### Вариант A: Через psql напрямую
```bash
# Подключение к PostgreSQL как пользователь postgres
sudo -u postgres psql your_database_name

# Или, если у вас другой пользователь БД:
psql -U your_db_user -d your_database_name -h localhost
```

Затем выполните SQL из файла миграции:
```sql
-- Вставьте сюда содержимое файла backend/migrations/create_tournament_logs_table.sql
```

#### Вариант B: Выполнение файла миграции
```bash
# Если у вас есть файл миграции на сервере
sudo -u postgres psql your_database_name < backend/migrations/create_tournament_logs_table.sql

# Или через пользователя БД:
psql -U your_db_user -d your_database_name -h localhost -f backend/migrations/create_tournament_logs_table.sql
```

### 4. Проверка создания таблицы
```sql
-- Подключитесь к БД и выполните:
\dt tournament_logs

-- Или проверьте структуру:
\d tournament_logs

-- Должны увидеть что-то вроде:
--                                Table "public.tournament_logs"
--    Column     |           Type           | Collation | Nullable |                  Default
-- --------------+--------------------------+-----------+----------+-------------------------------------------
--  id           | integer                  |           | not null | nextval('tournament_logs_id_seq'::regclass)
--  tournament_id| integer                  |           | not null |
--  user_id      | integer                  |           |          |
--  event_type   | character varying(50)    |           | not null |
--  event_data   | jsonb                    |           |          |
--  created_at   | timestamp with time zone |           |          | CURRENT_TIMESTAMP
```

### 5. Перезапуск Node.js приложения
```bash
# Если используете PM2:
pm2 restart all

# Если используете systemctl:
sudo systemctl restart your-node-app

# Если используете Docker:
docker-compose restart backend

# Или просто:
sudo systemctl reload nginx
```

### 6. Проверка работоспособности
1. Откройте браузер и перейдите на страницу любого турнира
2. Перейдите на вкладку "Журнал событий"
3. Убедитесь, что ошибка 500 больше не возникает
4. Журнал должен отображаться (пустой для существующих турниров, но без ошибок)

## Возможные проблемы и их решения

### Ошибка "permission denied"
```bash
# Убедитесь, что пользователь имеет права на создание таблиц:
sudo -u postgres psql
GRANT CREATE ON DATABASE your_database_name TO your_db_user;
```

### Ошибка "relation tournaments does not exist"
```bash
# Проверьте, что основные таблицы существуют:
sudo -u postgres psql your_database_name
\dt tournaments
```

### Ошибка подключения к БД
```bash
# Проверьте статус PostgreSQL:
sudo systemctl status postgresql

# Перезапустите при необходимости:
sudo systemctl restart postgresql
```

## Тестирование

После успешного применения миграции:

1. **Создайте тестовый турнир** - журнал должен записать событие создания
2. **Зарегистрируйтесь в турнире** - должно появиться событие регистрации
3. **Сгенерируйте сетку** - должно появиться событие генерации сетки
4. **Проведите тестовый матч** - должно появиться событие завершения матча

## Безопасность

⚠️ **Важно**: Перед применением миграции в продакшн среде:

1. **Создайте резервную копию БД**:
```bash
sudo -u postgres pg_dump your_database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Проверьте миграцию на тестовой среде** (если возможно)

3. **Применяйте миграцию в период низкой нагрузки**

## Логирование

После исправления в журнале событий будут отображаться следующие типы событий:
- `tournament_created` - создание турнира
- `participant_joined` - участник присоединился
- `participant_left` - участник покинул турнир  
- `tournament_started` - турнир начался
- `tournament_completed` - турнир завершен
- `bracket_generated` - сетка сгенерирована
- `bracket_regenerated` - сетка пересоздана
- `match_completed` - матч завершен
- `round_completed` - раунд завершен
- `admin_assigned` - назначен администратор
- `admin_removed` - удален администратор
- `settings_changed` - изменены настройки турнира

---

**Автор**: AI Assistant  
**Дата**: 2024-12-19  
**Версия**: 1.0 