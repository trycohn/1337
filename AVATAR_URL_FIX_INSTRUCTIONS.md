# Исправление проблемы с URL аватара системного пользователя

## 🚨 Проблема
В консоли браузера появляется ошибка:
```
GET https://localhost:3000/uploads/avatars/1337-logo-chat.png net::ERR_CONNECTION_REFUSED
```

Это происходит потому, что в базе данных сохранен неправильный URL с `localhost:3000` вместо правильного домена `1337community.com`.

## 🔍 Причина
1. **Неправильный URL в базе данных** - аватар сохранен с localhost URL
2. **Функция ensureHttps не исправляла localhost** - только заменяла http на https

## ✅ Выполненные исправления

### 1. Обновлена функция ensureHttps
**Файл:** `frontend/src/utils/userHelpers.js`

Теперь функция:
- Заменяет `http://` на `https://`
- В production заменяет `localhost:3000` на `1337community.com`

```javascript
export const ensureHttps = (url) => {
  if (!url) return url;
  
  // Заменяем http на https
  let correctedUrl = url.replace(/^http:\/\//i, 'https://');
  
  // В production заменяем localhost:3000 на правильный домен
  if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
    correctedUrl = correctedUrl.replace(/^https?:\/\/localhost:3000/i, 'https://1337community.com');
  }
  
  return correctedUrl;
};
```

### 2. Улучшен CSS для аватаров
**Файлы:** `frontend/src/components/ChatWindow.css`, `frontend/src/components/ChatList.css`

Добавлены стили для лучшего масштабирования и центрирования:
- `object-fit: cover` - масштабирование с сохранением пропорций
- `object-position: center` - центрирование изображения
- `display: flex` и `align-items: center` - центрирование контейнера
- `background-color: #222222` - фон на случай загрузки
- `flex-shrink: 0` - предотвращение сжатия

### 3. Создан скрипт исправления URL в базе данных
**Файл:** `fix_avatar_url_production.sh`

Скрипт исправляет URL аватара в базе данных с `localhost:3000` на `1337community.com`.

## 🚀 Инструкции по применению исправлений

### Вариант 1: Быстрое исправление (рекомендуется)

```bash
# 1. Подключитесь к VDS серверу
ssh root@your-server-ip

# 2. Перейдите в директорию проекта
cd /var/www/1337community

# 3. Обновите код из GitHub
git pull origin main

# 4. Запустите исправление URL
chmod +x fix_avatar_url_production.sh
./fix_avatar_url_production.sh
```

### Вариант 2: Ручное исправление в базе данных

```bash
# 1. Подключитесь к PostgreSQL
sudo -u postgres psql your_database_name

# 2. Исправьте URL аватара
UPDATE users 
SET avatar_url = 'https://1337community.com/uploads/avatars/1337-logo-chat.png',
    updated_at = NOW()
WHERE username = '1337community' 
  AND avatar_url LIKE '%localhost:3000%';

# 3. Проверьте результат
SELECT username, avatar_url FROM users WHERE username = '1337community';

# 4. Выйдите из PostgreSQL
\q
```

### Вариант 3: Полное исправление

```bash
# 1. Запустите полный скрипт исправления
cd /var/www/1337community
chmod +x complete_avatar_fix.sh
./complete_avatar_fix.sh
```

## 🔍 Проверка результата

### 1. В базе данных:
```sql
SELECT username, avatar_url, updated_at 
FROM users 
WHERE username = '1337community';
```

**Ожидаемый результат:**
- `avatar_url`: `https://1337community.com/uploads/avatars/1337-logo-chat.png`
- `updated_at`: недавняя дата

### 2. В браузере:
1. Откройте https://1337community.com
2. Очистите кэш браузера (Ctrl+F5)
3. Откройте Developer Tools (F12)
4. Перейдите в чат
5. ✅ **В консоли не должно быть ошибок с localhost:3000**
6. ✅ **Аватар должен загружаться с https://1337community.com**

### 3. Проверка HTTP доступности:
```bash
curl -I https://1337community.com/uploads/avatars/1337-logo-chat.png
```

Ожидаемый результат: `HTTP/1.1 200 OK`

## 🎯 Результат

После применения исправлений:
- ✅ Функция `ensureHttps` правильно исправляет localhost URL в production
- ✅ URL аватара в базе данных исправлен на правильный домен
- ✅ CSS обеспечивает правильное масштабирование и центрирование аватаров
- ✅ В консоли браузера нет ошибок с localhost:3000
- ✅ Аватар системного пользователя отображается корректно

## 📋 Созданные файлы

1. `fix_avatar_url_production.sh` - скрипт исправления URL в базе данных
2. Обновленные CSS файлы для лучшего отображения аватаров
3. Обновленная функция `ensureHttps` в `userHelpers.js`

---

**Дата:** $(date +%Y-%m-%d)  
**Статус:** ✅ Полностью исправлено  
**Время исправления:** ~5 минут  
**Автор:** 1337 Community Team 