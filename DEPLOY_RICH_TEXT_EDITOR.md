# 🚀 ИНСТРУКЦИЯ ПО РАЗВЕРТЫВАНИЮ RICH TEXT РЕДАКТОРА НА VDS

## 📋 ОБЗОР ИЗМЕНЕНИЙ

Rich Text редактор с полной защитой от XSS атак интегрирован в систему управления турнирами для редактирования описаний и регламентов.

### ✨ Новый функционал:
- **SafeRichTextEditor** - безопасный WYSIWYG редактор
- **SafeRichTextDisplay** - защищенное отображение контента
- **Backend HTML валидация** - многоуровневая защита от XSS
- **Монохромная тема** - соответствует дизайну проекта

---

## 🔧 ПОДГОТОВКА К РАЗВЕРТЫВАНИЮ

### 1. Подключение к VDS серверу
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Переход в директорию проекта
```bash
cd /var/www/1337community.com/
```

### 3. Проверка текущего состояния
```bash
git status
git log --oneline -5
```

---

## 📦 РАЗВЕРТЫВАНИЕ BACKEND

### 1. Обновление кода из GitHub
```bash
# Сохранение текущих изменений (если есть)
git stash

# Получение последних изменений
git pull origin main

# Применение сохраненных изменений (если были)
git stash pop
```

### 2. Установка новых зависимостей (если требуется)
```bash
cd backend
npm install
```

### 3. Проверка новых файлов
```bash
# Проверить наличие нового валидатора HTML
ls -la utils/htmlValidator.js

# Проверить обновленный контроллер
ls -la controllers/tournament/TournamentController.js
```

### 4. Перезапуск backend сервиса
```bash
# Остановка текущего процесса
pm2 stop 1337-backend

# Запуск с обновленным кодом
pm2 start 1337-backend

# Проверка статуса
pm2 status
pm2 logs 1337-backend --lines 20
```

---

## 🎨 РАЗВЕРТЫВАНИЕ FRONTEND

### 1. Переход в директорию frontend
```bash
cd /var/www/1337community.com/frontend
```

### 2. Установка новых зависимостей
```bash
# Установка React Quill и DOMPurify
npm install react-quill dompurify --legacy-peer-deps
```

### 3. Проверка новых компонентов
```bash
# Проверить новые компоненты
ls -la src/components/SafeRichText*

# Проверить обновленные файлы
ls -la src/components/TournamentInfoSection.*
```

### 4. Сборка production версии
```bash
# Сборка оптимизированной версии
npm run build

# Проверка успешности сборки
echo $?  # Должно вывести 0
```

### 5. Обновление статических файлов
```bash
# Резервное копирование текущей версии
cp -r build build_backup_$(date +%Y%m%d_%H%M%S)

# Копирование новой сборки (если используется отдельная директория для статики)
# cp -r build/* /var/www/1337community.com/public/
```

---

## 🔄 ПЕРЕЗАПУСК СЕРВИСОВ

### 1. Перезапуск Nginx
```bash
# Проверка конфигурации
nginx -t

# Перезагрузка конфигурации
systemctl reload nginx

# Проверка статуса
systemctl status nginx
```

### 2. Проверка backend процесса
```bash
# Статус PM2 процессов
pm2 status

# Логи backend сервера
pm2 logs 1337-backend --lines 50

# При необходимости - полный перезапуск
pm2 restart 1337-backend
```

---

## ✅ ПРОВЕРКА РАБОТОСПОСОБНОСТИ

### 1. Проверка API endpoints
```bash
# Тест доступности API
curl -I http://localhost:3001/api/tournaments

# Проверка логов на ошибки
pm2 logs 1337-backend --lines 20 | grep -i error
```

### 2. Проверка frontend
```bash
# Проверка доступности статических файлов
curl -I http://80.87.200.23/

# Проверка загрузки CSS файлов
curl -I http://80.87.200.23/static/css/main.*.css
```

### 3. Функциональное тестирование
1. Откройте браузер: `http://80.87.200.23`
2. Войдите как администратор турнира
3. Перейдите к любому турниру
4. Проверьте работу редактора в разделах "Описание" и "Регламент"

---

## 🛡️ ПРОВЕРКА БЕЗОПАСНОСТИ

### 1. Тест HTML валидации
```bash
# Создать тестовый файл
cat > test_html_validation.js << 'EOF'
const { validateTournamentDescription } = require('./backend/utils/htmlValidator');

// Тест безопасного контента
console.log('✅ Безопасный контент:', 
  validateTournamentDescription('<p><strong>Тест</strong></p>'));

// Тест опасного контента  
console.log('❌ Опасный контент:', 
  validateTournamentDescription('<script>alert("XSS")</script>'));
EOF

# Запуск теста
node test_html_validation.js

# Удаление тестового файла
rm test_html_validation.js
```

### 2. Проверка CSP заголовков (рекомендуется)
```bash
# Добавить в конфигурацию Nginx
cat >> /etc/nginx/sites-available/1337community.com << 'EOF'
    # Content Security Policy для дополнительной защиты
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;" always;
EOF

# Перезагрузка Nginx
nginx -t && systemctl reload nginx
```

---

## 🔍 МОНИТОРИНГ И ЛОГИ

### 1. Мониторинг backend логов
```bash
# Отслеживание логов в реальном времени
pm2 logs 1337-backend --follow

# Поиск ошибок HTML валидации
pm2 logs 1337-backend | grep -i "html\|xss\|валидация"
```

### 2. Мониторинг Nginx логов
```bash
# Логи доступа
tail -f /var/log/nginx/access.log

# Логи ошибок
tail -f /var/log/nginx/error.log
```

### 3. Мониторинг системных ресурсов
```bash
# Использование памяти процессом Node.js
ps aux | grep node

# Использование диска
df -h

# Загрузка системы
htop
```

---

## 🚨 РЕШЕНИЕ ПРОБЛЕМ

### Проблема 1: Ошибка при установке зависимостей
```bash
# Очистка npm cache
npm cache clean --force

# Удаление node_modules и переустановка
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Проблема 2: Ошибки сборки frontend
```bash
# Проверка версии Node.js
node --version  # Должно быть >= 16

# Увеличение памяти для сборки
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### Проблема 3: PM2 процесс не запускается
```bash
# Проверка конфигурации PM2
pm2 show 1337-backend

# Перезапуск с выводом ошибок
pm2 delete 1337-backend
pm2 start backend/server.js --name "1337-backend"
```

### Проблема 4: Rich Text редактор не загружается
```bash
# Проверка наличия файлов компонентов
ls -la /var/www/1337community.com/frontend/src/components/SafeRichText*

# Проверка сборки CSS
ls -la /var/www/1337community.com/frontend/build/static/css/

# Пересборка с детальными логами
npm run build -- --verbose
```

---

## 📊 КОНТРОЛЬНЫЙ СПИСОК РАЗВЕРТЫВАНИЯ

### Backend ✅
- [ ] Код обновлен из GitHub
- [ ] Новые зависимости установлены
- [ ] Файл `htmlValidator.js` присутствует
- [ ] `TournamentController.js` обновлен
- [ ] PM2 процесс перезапущен
- [ ] Логи не содержат ошибок

### Frontend ✅
- [ ] Зависимости `react-quill` и `dompurify` установлены
- [ ] Компоненты `SafeRichTextEditor.js` и `SafeRichTextDisplay.js` созданы
- [ ] `TournamentInfoSection.js` обновлен
- [ ] CSS файлы обновлены
- [ ] Production сборка выполнена успешно
- [ ] Статические файлы обновлены

### Безопасность ✅
- [ ] HTML валидация работает
- [ ] XSS защита активна
- [ ] CSP заголовки настроены (опционально)
- [ ] Тестирование безопасности пройдено

### Функциональность ✅
- [ ] Rich Text редактор загружается
- [ ] Форматирование текста работает
- [ ] Сохранение контента функционирует
- [ ] Отображение контента корректно
- [ ] Мобильная версия работает

---

## 📞 ПОДДЕРЖКА

При возникновении проблем:

1. **Проверьте логи:** `pm2 logs 1337-backend`
2. **Проверьте статус сервисов:** `systemctl status nginx`
3. **Проверьте доступность портов:** `netstat -tulpn | grep :3001`
4. **Перезапустите сервисы:** `pm2 restart all && systemctl reload nginx`

### Команды быстрой диагностики:
```bash
# Полная диагностика системы
echo "=== PM2 STATUS ===" && pm2 status && \
echo "=== NGINX STATUS ===" && systemctl status nginx && \
echo "=== DISK SPACE ===" && df -h && \
echo "=== MEMORY USAGE ===" && free -h && \
echo "=== LAST LOGS ===" && pm2 logs 1337-backend --lines 10
```

---

## 🎉 ЗАВЕРШЕНИЕ

После успешного развертывания Rich Text редактор будет доступен для всех администраторов турниров. Пользователи смогут создавать красиво отформатированные описания и регламенты с полной защитой от XSS атак.

**Проект готов к продакшену!** 🚀