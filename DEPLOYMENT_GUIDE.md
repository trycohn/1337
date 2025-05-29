# Руководство по развертыванию исправлений на VDS сервере

## Исправления в версии 1.0.0

### Исправленная проблема
- ❌ **Ошибка**: "Cannot access 'jt' before initialization" в турнирной сетке
- ✅ **Решение**: Создана новая утилитарная функция `safeParseBracketId`

### Внесенные изменения
1. `frontend/src/utils/safeParseInt.js` - новая утилитарная функция
2. `frontend/src/components/BracketRenderer.js` - обновленные импорты
3. `frontend/package.json` - версия обновлена до 1.0.0
4. `frontend/src/components/TournamentDetails.js` - очистка неиспользуемых импортов

## Исправления в версии 1.0.1

### Исправленная проблема
- ❌ **Ошибка**: "Cannot access 'jt' before initialization" в турнирной сетке
- ✅ **Решение**: 
  1. Создана утилитарная функция `safeParseBracketId` в версии 1.0.0 (недостаточно)
  2. Исправлены функции `isUserParticipant` и `isInvitationSent` в `TournamentDetails.js` в версии 1.0.1

### Внесенные изменения
1. `frontend/src/utils/safeParseInt.js` - новая утилитарная функция
2. `frontend/src/components/BracketRenderer.js` - обновленные импорты
3. `frontend/package.json` - версия обновлена до 1.0.0
4. `frontend/src/components/TournamentDetails.js` - исправлена проблема TDZ (Temporal Dead Zone) с функциями

## Инструкции для развертывания на VDS сервере

### 1. Подключение к серверу
```bash
ssh your-username@your-server-ip
```

### 2. Переход в директорию проекта
```bash
cd /path/to/your/project/1337
```

### 3. Получение обновлений из GitHub
```bash
# Проверить текущее состояние
git status

# Получить последние изменения
git pull origin main

# Проверить, что изменения получены
git log --oneline -3
```

### 4. Обновление зависимостей (если изменились)
```bash
# Backend (если package.json изменился)
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
```

### 5. Сборка frontend приложения
```bash
cd frontend

# Очистка предыдущей сборки
rm -rf build node_modules/.cache

# Сборка без source maps для production
GENERATE_SOURCEMAP=false npm run build

# Проверка успешности сборки
ls -la build/static/js/main.*.js
```

### 6. Перезапуск сервисов

#### Если используется PM2:
```bash
# Перезапуск backend
pm2 restart backend

# Проверка статуса
pm2 status
pm2 logs backend --lines 20
```

#### Если используется systemctl:
```bash
# Перезапуск Node.js приложения
sudo systemctl restart your-app-name

# Проверка статуса
sudo systemctl status your-app-name
```

#### Перезагрузка Nginx:
```bash
# Проверка конфигурации
sudo nginx -t

# Перезагрузка конфигурации
sudo systemctl reload nginx

# Или полный перезапуск
sudo systemctl restart nginx
```

### 7. Проверка развертывания

#### Проверка файлов:
```bash
# Проверить, что новый файл main.js имеет другой хеш
ls -la frontend/build/static/js/main.*.js

# Проверить размер файлов
du -h frontend/build/static/js/main.*.js
```

#### Проверка работы сайта:
```bash
# Проверить доступность сайта
curl -I http://your-domain.com

# Проверить работу API
curl http://your-domain.com/api/health
```

#### Проверка логов:
```bash
# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Логи приложения (PM2)
pm2 logs backend --lines 50

# Системные логи (systemctl)
journalctl -u your-app-name -f
```

### 8. Проверка исправления

1. Откройте сайт в браузере
2. Перейдите на страницу турнира
3. Откройте инструменты разработчика (F12)
4. Проверьте консоль - ошибка "Cannot access 'jt' before initialization" не должна появляться
5. Убедитесь, что турнирная сетка загружается корректно

### 9. Принудительная очистка кеша браузера (если нужно)

Если изменения не видны в браузере:
```bash
# Добавить заголовки кеширования в Nginx
# В /etc/nginx/sites-available/your-site:

location ~* \.(js|css)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header ETag $request_id;
}

# Перезагрузить Nginx
sudo systemctl reload nginx
```

### 10. Откат в случае проблем

Если что-то пошло не так:
```bash
# Откат к предыдущему коммиту
git log --oneline -5
git reset --hard <previous-commit-hash>

# Пересборка
cd frontend
rm -rf build
npm run build

# Перезапуск сервисов
pm2 restart backend
sudo systemctl reload nginx
```

## Структура файлов после обновления

```
frontend/
├── src/
│   ├── utils/
│   │   └── safeParseInt.js          # ✅ Новый файл
│   └── components/
│       ├── BracketRenderer.js       # ✅ Обновлен
│       └── TournamentDetails.js     # ✅ Исправлен TDZ
├── package.json                     # ✅ Версия 1.0.0
└── build/
    └── static/js/
        └── main.a4a0e549.js         # ✅ Новый хеш файла (версия 1.0.1)
```

## Проверочный список

- [ ] Подключение к серверу выполнено
- [ ] Изменения получены через `git pull`
- [ ] Frontend собран успешно
- [ ] Новый main.js файл создан с хешем `a4a0e549`
- [ ] Backend перезапущен
- [ ] Nginx перезагружен
- [ ] Сайт доступен
- [ ] Турнирная сетка работает без ошибок
- [ ] Консоль браузера чистая от ошибок 'jt'

## Контакты для поддержки

В случае проблем с развертыванием проверьте:
1. Логи сервера
2. Логи приложения  
3. Статус сервисов
4. Права доступа к файлам

---
*Дата создания: $(date)*
*Версия: 1.0.0*

# Руководство по развертыванию исправления приглашений

## Проблема
При попытке пригласить участника в турнир через поиск появляется ошибка:
```
POST https://1337community.com/api/tournaments/59/invite 400 (Bad Request)
API Error (400): {error: 'Укажите никнейм или email'}
```

## Причина
Клиентский код отправлял параметр `user_id`, а серверный API ожидал `username` или `email`.

## Исправление
Изменена функция `handleInviteUser` в файле `frontend/src/components/TournamentDetails.js`:

**Было:**
```javascript
{ user_id: userId }
```

**Стало:**
```javascript
{ username: username }
```

## Развертывание на VDS сервере

### Вариант 1: Автоматическое развертывание

1. **Подключитесь к серверу по SSH:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Перейдите в директорию проекта:**
   ```bash
   cd /var/www/1337community
   ```

3. **Запустите скрипт развертывания:**
   ```bash
   chmod +x server-deploy.sh
   ./server-deploy.sh
   ```

### Вариант 2: Ручное развертывание

1. **Подключитесь к серверу:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Перейдите в директорию проекта:**
   ```bash
   cd /var/www/1337community
   ```

3. **Получите последние изменения:**
   ```bash
   git fetch origin
   git pull origin main
   ```

4. **Проверьте изменения:**
   ```bash
   git log --oneline -3
   git diff HEAD~1 frontend/src/components/TournamentDetails.js
   ```

5. **Обновите зависимости Frontend:**
   ```bash
   cd frontend
   npm install
   ```

6. **Соберите Frontend:**
   ```bash
   npm run build
   ```

7. **Установите права доступа:**
   ```bash
   sudo chown -R www-data:www-data build
   sudo chmod -R 755 build
   ```

8. **Перезапустите Backend сервис:**
   ```bash
   sudo systemctl restart 1337-backend
   ```

9. **Проверьте статус сервиса:**
   ```bash
   sudo systemctl status 1337-backend
   ```

10. **Перезагрузите Nginx:**
    ```bash
    sudo nginx -t
    sudo systemctl reload nginx
    ```

## Проверка исправления

1. **Откройте сайт:** https://1337community.com

2. **Перейдите к любому турниру**

3. **Найдите пользователя через поиск** (если вы создатель/админ турнира)

4. **Нажмите кнопку "пригласить"**

5. **Убедитесь, что ошибка исчезла** и появилось сообщение "Приглашение успешно отправлено"

## Мониторинг

### Логи Backend:
```bash
sudo journalctl -u 1337-backend -f
```

### Логи Nginx:
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Статус сервисов:
```bash
sudo systemctl status 1337-backend
sudo systemctl status nginx
```

## Откат изменений (если нужно)

1. **Найдите резервную копию:**
   ```bash
   ls -la /var/backups/1337community/
   ```

2. **Восстановите из резервной копии:**
   ```bash
   sudo cp -r /var/backups/1337community/YYYYMMDD_HHMMSS/1337community/* /var/www/1337community/
   ```

3. **Перезапустите сервисы:**
   ```bash
   sudo systemctl restart 1337-backend
   sudo systemctl reload nginx
   ```

## Возможные проблемы и решения

### 1. Ошибка прав доступа
```bash
sudo chown -R www-data:www-data /var/www/1337community/frontend/build
sudo chmod -R 755 /var/www/1337community/frontend/build
```

### 2. Сервис не запускается
```bash
sudo journalctl -u 1337-backend --no-pager -l -n 50
```

### 3. Nginx ошибки
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### 4. Проблемы с Node.js
```bash
cd /var/www/1337community/backend
npm install --production
```

### 5. Проблемы с сборкой Frontend
```bash
cd /var/www/1337community/frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Проверка API

Проверить работу API можно командой:
```bash
curl -X POST https://1337community.com/api/tournaments/TOURNAMENT_ID/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"username": "test_user"}'
```

## Контакты для поддержки

При возникновении проблем:
1. Проверьте логи сервисов
2. Убедитесь, что все сервисы запущены
3. Проверьте права доступа к файлам
4. При необходимости выполните откат изменений

## Дополнительные команды

### Проверка дискового пространства:
```bash
df -h
```

### Проверка использования памяти:
```bash
free -h
```

### Проверка процессов Node.js:
```bash
ps aux | grep node
```

### Проверка портов:
```bash
netstat -tlnp | grep :3001
``` 