# 🚀 ДЕПЛОЙ ИСПРАВЛЕНИЯ FULL MIX SE/DE

## Краткая инструкция для деплоя изменений составов

### ✅ Что было исправлено:

1. **Фронтенд** - кнопка "Подтвердить составы" теперь вызывает правильный endpoint:
   - SE/DE → `/confirm-rosters` (сохраняет в metadata)
   - Swiss → `/approve` (старый метод)

2. **Backend** - исторические составы сохраняются и отображаются правильно

---

## 📦 ДЕПЛОЙ НА СЕРВЕР (выполнять на локальной машине):

### Шаг 1: Коммит и пуш

```bash
# В локальной папке проекта
cd C:\Users\Admin\Desktop\Клубы\1337brackets\sept2025\1337

# Добавить все изменения
git add .

# Закоммитить
git commit -m "fix: Full Mix SE/DE rosters confirmation and display

- Исправлена кнопка подтверждения составов в черновике
- Для SE/DE теперь вызывается /confirm-rosters
- Добавлена фильтрация выбывших участников
- Исправлено отображение исторических составов в сетке"

# Запушить на GitHub
git push origin main
```

---

## 🔧 ДЕПЛОЙ НА VDS (выполнять на сервере):

```bash
# Подключение к серверу
ssh root@80.87.200.23

# Переход в папку проекта
cd /var/www/1337community.com

# Получение изменений
git pull origin main

# Сборка фронтенда на сервере
cd frontend
npm run build
cd ..

# Перезапуск backend
sudo systemctl restart 1337-backend

# Проверка статуса
sudo systemctl status 1337-backend

# Перезагрузка nginx
sudo systemctl reload nginx

# Готово!
echo "✅ Деплой завершен!"
```

---

## 🧪 ПРОВЕРКА РАБОТЫ:

### На сервере - проверить логи:

```bash
# Смотреть логи в реальном времени
sudo journalctl -u 1337-backend -f
```

### В браузере:

1. **Очистить кеш браузера:** `Ctrl+Shift+Delete` → выбрать "Кешированные изображения и файлы"
2. **Или принудительная перезагрузка:** `Ctrl+Shift+R` (или `Ctrl+F5`)
3. Открыть: `https://1337community.com/tournaments/23/fullmix/draft?round=2`
4. Нажать "Подтвердить составы"
5. В консоли браузера (F12) должно быть:
   ```
   🆕 SE/DE: используем endpoint confirm-rosters
   ```
6. В логах backend должно быть:
   ```
   POST /api/tournaments/23/fullmix/rounds/2/confirm-rosters 200
   ```

### Проверка сетки:

1. Открыть: `https://1337community.com/tournaments/23?tab=bracket`
2. Нажать "Раскрыть составы"
3. **Составы раунда 2 должны отображаться правильно** (4 участника, не выбывшие)

---

## ⚠️ ВАЖНО:

- После деплоя пользователям нужно очистить кеш браузера
- Если WebSocket не работает - это отдельная проблема с Nginx (не критично)
- Составы теперь сохраняются в БД и отображаются исторически

---

## 🐛 Если что-то не работает:

1. **Проверить что изменения на сервере:**
   ```bash
   cat /var/www/1337community.com/frontend/src/pages/FullMixDraftPage.js | grep -A 5 "confirm-rosters"
   ```
   Должна быть строка с endpoint

2. **Проверить что build обновился:**
   ```bash
   ls -lh /var/www/1337community.com/frontend/build/static/js/main.*.js
   ```
   Дата должна быть сегодняшняя

3. **Проверить логи backend:**
   ```bash
   sudo journalctl -u 1337-backend -n 100
   ```

4. **Перезапустить всё:**
   ```bash
   sudo systemctl restart 1337-backend
   sudo systemctl restart nginx
   ```

