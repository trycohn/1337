# 🚀 БЫСТРОЕ ИСПРАВЛЕНИЕ WEBSOCKET

## Вариант 1: Автоматическое копирование (из Windows)

```bash
# В PowerShell выполните:
chmod +x deploy_websocket_fix.sh
./deploy_websocket_fix.sh
```

Введите пароль: `01012006Fortnite!` когда попросит.

## Вариант 2: Ручное выполнение

### Шаг 1: Подключитесь к серверу
```bash
ssh root@80.87.200.23
```
Пароль: `01012006Fortnite!`

### Шаг 2: Перейдите в папку проекта
```bash
cd /var/www/1337community.com
```

### Шаг 3: Создайте скрипт диагностики
```bash
nano fix_websocket_issue.sh
```

Вставьте содержимое из файла `fix_websocket_issue.sh` (Ctrl+Shift+V), затем:
- Ctrl+X
- Y
- Enter

### Шаг 4: Создайте скрипт исправления
```bash
nano apply_websocket_fix.sh
```

Вставьте содержимое из файла `apply_websocket_fix.sh` (Ctrl+Shift+V), затем:
- Ctrl+X
- Y
- Enter

### Шаг 5: Сделайте скрипты исполняемыми
```bash
chmod +x fix_websocket_issue.sh apply_websocket_fix.sh
```

### Шаг 6: Запустите диагностику
```bash
./fix_websocket_issue.sh
```

### Шаг 7: Примените исправления
```bash
./apply_websocket_fix.sh
```

## Проверка результата

1. Откройте https://1337community.com
2. Откройте консоль браузера (F12)
3. Перейдите на вкладку Network
4. Найдите WebSocket соединения (фильтр WS)
5. Должен быть статус 101 (не 400)

## Если нужна помощь

Сохраните вывод команд и покажите результаты диагностики. 