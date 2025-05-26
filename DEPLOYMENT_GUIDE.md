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
│       └── TournamentDetails.js     # ✅ Очищен
├── package.json                     # ✅ Версия 1.0.0
└── build/
    └── static/js/
        └── main.42fd8b49.js         # ✅ Новый хеш файла
```

## Проверочный список

- [ ] Подключение к серверу выполнено
- [ ] Изменения получены через `git pull`
- [ ] Frontend собран успешно
- [ ] Новый main.js файл создан с хешем `42fd8b49`
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