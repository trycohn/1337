# Быстрое развертывание на VDS сервере

## ⚡ Автоматическое развертывание (рекомендуется)

```bash
# На VDS сервере:
cd /path/to/your/project/1337
chmod +x deploy.sh
./deploy.sh
```

## 🔧 Ручное развертывание

```bash
# 1. Получить обновления
git pull origin main

# 2. Собрать frontend
cd frontend
rm -rf build node_modules/.cache
GENERATE_SOURCEMAP=false npm run build

# 3. Перезапустить сервисы
pm2 restart backend
sudo systemctl reload nginx
```

## ✅ Проверка исправления

1. Откройте сайт в браузере
2. Перейдите на страницу турнира
3. Откройте консоль (F12)
4. **Проверьте**: ошибка "Cannot access 'jt' before initialization" исчезла

## 📋 Что было исправлено

- ✅ Создана функция `safeParseBracketId` в `frontend/src/utils/safeParseInt.js`
- ✅ Обновлен `BracketRenderer.js` для использования новой функции
- ✅ Версия обновлена до 1.0.0 для сброса кеша
- ✅ Новый хеш файла: `main.42fd8b49.js`

## 🆘 В случае проблем

```bash
# Откат к предыдущей версии
git reset --hard HEAD~1
cd frontend && npm run build
pm2 restart backend && sudo systemctl reload nginx
```

---
📞 **Поддержка**: Проверьте `DEPLOYMENT_GUIDE.md` для подробных инструкций 