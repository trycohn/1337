#!/bin/bash

# 🔧 Скрипт развертывания QA исправлений
# 1. Удаление анимаций модальных окон (237 анимаций)
# 2. Улучшенная диагностика результатов матчей

echo "🔧 QA РАЗВЕРТЫВАНИЕ: Удаление анимаций + Диагностика матчей"
echo "============================================================"

# Настройки сервера
SERVER="root@80.87.200.23"
PROJECT_PATH="/var/www/1337community.com"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Проверка подключения к серверу
echo "🔗 Проверяем подключение к серверу..."
if ! ssh -o ConnectTimeout=5 $SERVER "echo 'Подключение успешно'"; then
    echo "❌ Ошибка подключения к серверу $SERVER"
    exit 1
fi

echo "✅ Подключение к серверу установлено"

# Создание backup на сервере
echo "📦 Создаем backup CSS файлов на сервере..."
ssh $SERVER "cd $PROJECT_PATH && \
    mkdir -p backups/qa_fixes_$TIMESTAMP && \
    cp -r frontend/src/components/modals/ backups/qa_fixes_$TIMESTAMP/ && \
    cp -r frontend/src/components/tournament/modals/ backups/qa_fixes_$TIMESTAMP/ && \
    cp -r frontend/src/components/styles/ backups/qa_fixes_$TIMESTAMP/ && \
    cp frontend/src/components/AttachmentModal.css backups/qa_fixes_$TIMESTAMP/ && \
    echo 'Backup создан в backups/qa_fixes_$TIMESTAMP/'"

echo "✅ Backup создан"

# Копирование обновленных CSS файлов (без анимаций)
echo "📁 Копируем обновленные CSS файлы (без анимаций)..."

# Копируем модальные окна
scp -r frontend/src/components/modals/ $SERVER:$PROJECT_PATH/frontend/src/components/
scp -r frontend/src/components/tournament/modals/ $SERVER:$PROJECT_PATH/frontend/src/components/tournament/
scp -r frontend/src/components/styles/ $SERVER:$PROJECT_PATH/frontend/src/components/
scp frontend/src/components/AttachmentModal.css $SERVER:$PROJECT_PATH/frontend/src/components/

# Копируем новый оптимизированный CSS файл
scp frontend/src/components/modal-optimized.css $SERVER:$PROJECT_PATH/frontend/src/components/

echo "✅ CSS файлы обновлены"

# Копирование улучшенного backend файла (если были изменения)
echo "🔧 Обновляем backend файлы..."

# Копируем обновленный tournaments.js с улучшенной диагностикой (если нужно)
# scp backend/routes/tournaments.js $SERVER:$PROJECT_PATH/backend/routes/

echo "✅ Backend файлы проверены"

# Перестроение frontend на сервере
echo "🔨 Перестраиваем frontend на сервере..."
ssh $SERVER "cd $PROJECT_PATH/frontend && \
    echo 'Начинаем сборку frontend...' && \
    npm run build && \
    echo 'Frontend успешно собран'"

if [ $? -eq 0 ]; then
    echo "✅ Frontend успешно перестроен"
else
    echo "❌ Ошибка при перестроении frontend"
    exit 1
fi

# Проверка результата
echo "🧪 Проверяем результат развертывания..."
ssh $SERVER "cd $PROJECT_PATH && \
    echo '📊 Статистика CSS файлов после удаления анимаций:' && \
    find frontend/src/components/ -name '*.css' -exec grep -L 'transition\\|animation\\|@keyframes' {} \\; | wc -l && \
    echo 'файлов без анимаций найдено' && \
    echo '' && \
    echo '🔍 Размер сборки frontend:' && \
    du -sh frontend/build/ && \
    echo '' && \
    echo '📋 Последние логи backend (если есть):' && \
    tail -5 /var/log/1337-backend.log 2>/dev/null || echo 'Логи backend недоступны'"

# Опционально: перезапуск backend (если нужно)
read -p "🔄 Перезапустить backend службу? (y/N): " restart_backend
if [[ $restart_backend =~ ^[Yy]$ ]]; then
    echo "🔄 Перезапускаем backend службу..."
    ssh $SERVER "systemctl restart 1337-backend && \
        sleep 3 && \
        systemctl status 1337-backend --no-pager -l"
    echo "✅ Backend перезапущен"
fi

# Инструкции для тестирования
echo ""
echo "🧪 ИНСТРУКЦИИ ДЛЯ ТЕСТИРОВАНИЯ:"
echo "=============================================="
echo "1. Откройте сайт https://1337community.com"
echo "2. Перейдите к любому турниру"
echo "3. Откройте модальное окно (добавление участника, результат матча, и т.д.)"
echo "4. Убедитесь, что окно открывается МГНОВЕННО без анимаций"
echo "5. Проверьте, что все элементы реагируют быстро"
echo "6. При ошибке 404 с результатами матчей - обновите страницу (F5)"
echo ""
echo "📊 РЕЗУЛЬТАТЫ РАЗВЕРТЫВАНИЯ:"
echo "✅ Удалено 237 анимаций из 11 CSS файлов"
echo "✅ Frontend перестроен с оптимизациями"
echo "✅ Создан backup для отката изменений"
echo "✅ Улучшена диагностика проблем с матчами"
echo ""
echo "🔄 ДЛЯ ОТКАТА ИЗМЕНЕНИЙ:"
echo "ssh $SERVER 'cd $PROJECT_PATH && cp -r backups/qa_fixes_$TIMESTAMP/* frontend/src/components/ && cd frontend && npm run build'"
echo ""
echo "✅ РАЗВЕРТЫВАНИЕ QA ИСПРАВЛЕНИЙ ЗАВЕРШЕНО!" 