# 1337 Community - Инструкции для Windows

## 🚀 Быстрый запуск

### Вариант 1: Использование bat-файлов (Рекомендуется для Windows)
1. **Frontend**: Двойной клик на `start-frontend.bat`
2. **Backend**: Двойной клик на `start-backend.bat`

### Вариант 2: Использование PowerShell/Command Prompt
```powershell
# Запуск фронтенда
npm start

# Или вручную
cd frontend
npm start

# Запуск бэкенда (в новом окне)
npm run start:backend
```

### Вариант 3: Использование отдельных команд
```powershell
# Фронтенд (из корневой папки)
cd frontend && npm start

# Бэкенд (из корневой папки)  
npm run dev
```

## 📁 Структура проекта
```
1337/
├── frontend/           # React приложение
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/           # Node.js API сервер
├── package.json       # Корневой package.json
├── start-frontend.bat # Быстрый запуск фронтенда
└── start-backend.bat  # Быстрый запуск бэкенда
```

## 🛠️ Доступные команды

### Из корневой папки:
- `npm start` - Запуск фронтенда
- `npm run start:frontend` - Запуск фронтенда  
- `npm run start:backend` - Запуск бэкенда
- `npm run build` - Сборка фронтенда для продакшена
- `npm test` - Запуск тестов

### Из папки frontend:
- `npm start` - Запуск development сервера
- `npm run build` - Сборка для продакшена
- `npm test` - Запуск тестов

## 🔧 Устранение проблем

### Проблема с NODE_OPTIONS в Windows
Если видите ошибку `"NODE_OPTIONS" не является внутренней или внешней командой`:
1. Используйте bat-файлы для запуска
2. Или запускайте из папки frontend: `cd frontend && npm start`

### Проблема с символом &&
В PowerShell используйте `;` вместо `&&`:
```powershell
cd frontend; npm start
```

## 🌐 URL'ы после запуска
- **Frontend**: http://localhost:3001
- **Backend**: http://localhost:3000

## 📦 Требования
- Node.js v16+
- npm v8+
- PostgreSQL (для бэкенда) 