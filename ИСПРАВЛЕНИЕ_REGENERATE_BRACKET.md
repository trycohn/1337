# 🔧 Исправление ошибки перегенерации турнирной сетки

**Проблема:** При нажатии кнопки "Перегенерировать сетку" возникает ошибка 404 (Not Found)

**Причина:** Отсутствует API endpoint `/api/tournaments/:id/regenerate-bracket` на сервере

**Решение:** Добавлен новый API endpoint в `backend/routes/tournaments.js`

## 📋 Инструкции по развертыванию

### 1. Подключение к серверу
```bash
ssh root@80.87.200.23
# Пароль: 01012006Fortnite!
```

### 2. Переход в директорию проекта
```bash
cd /var/www/1337community.com
```

### 3. Создание backup текущего файла
```bash
cp backend/routes/tournaments.js backend/routes/tournaments.js.backup.$(date +%Y%m%d_%H%M%S)
```

### 4. Копирование обновленного файла
На локальной машине выполните:
```bash
scp backend/routes/tournaments.js root@80.87.200.23:/var/www/1337community.com/backend/routes/tournaments.js
```

### 5. Перезапуск backend службы
На сервере:
```bash
systemctl restart 1337-backend
systemctl status 1337-backend
```

### 6. Проверка логов
```bash
journalctl -u 1337-backend -f --lines=50
```

## 🧪 Тестирование

После развертывания:

1. Зайдите на сайт: https://1337community.com
2. Откройте турнир с существующей сеткой
3. Перейдите на вкладку "Управление" (если вы админ/создатель)
4. Нажмите кнопку "🔄 Перегенерировать сетку"
5. Подтвердите действие
6. Проверьте, что сетка перегенерировалась без ошибок

## 📝 Детали изменения

**Добавленный endpoint:** `POST /api/tournaments/:id/regenerate-bracket`

**Функциональность:**
- ✅ Проверка прав доступа (создатель или администратор)
- ✅ Проверка статуса турнира (только активные)
- ✅ Проверка существования сетки
- ✅ Полное удаление текущих матчей
- ✅ Генерация новой сетки с сохранением участников
- ✅ WebSocket уведомления всем клиентам
- ✅ Сообщение в чат турнира
- ✅ Детальное логирование

**Параметры запроса:**
```json
{
  "thirdPlaceMatch": true|false  // опционально
}
```

**Ответ:**
```json
{
  "success": true,
  "message": "Турнирная сетка успешно перегенерирована",
  "tournament": { /* данные турнира */ }
}
```

## 🔍 Диагностика проблем

### Проверка API endpoint
```bash
# На сервере проверьте, что endpoint доступен
curl -X POST http://localhost:3000/api/tournaments/59/regenerate-bracket \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"thirdPlaceMatch": false}'
```

### Проверка логов backend
```bash
journalctl -u 1337-backend | grep "regenerate-bracket"
```

### Если ошибка повторяется
1. Проверьте, что файл был скопирован: `ls -la backend/routes/tournaments.js`
2. Проверьте права на файл: `chown 1337-backend:1337-backend backend/routes/tournaments.js`
3. Проверьте статус службы: `systemctl status 1337-backend`
4. Перезапустите службу: `systemctl restart 1337-backend`

## ⚡ Быстрое развертывание одной командой

```bash
# На локальной машине
scp backend/routes/tournaments.js root@80.87.200.23:/var/www/1337community.com/backend/routes/tournaments.js && \
ssh root@80.87.200.23 "cd /var/www/1337community.com && systemctl restart 1337-backend && echo 'Развертывание завершено!'"
```

---
**Статус:** Готово к развертыванию  
**Приоритет:** Высокий (блокирует функциональность)  
**Время выполнения:** ~2-3 минуты 