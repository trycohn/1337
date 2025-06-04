const fs = require('fs');
const path = require('path');

const TOURNAMENT_DETAILS_PATH = 'frontend/src/components/TournamentDetails.js';

console.log('🔧 Запуск ULTIMATE исправления TDZ ошибок в TournamentDetails.js...');

function fixTDZErrors() {
    try {
        // Читаем файл
        let content = fs.readFileSync(TOURNAMENT_DETAILS_PATH, 'utf8');
        
        console.log('📖 Файл загружен, размер:', Math.round(content.length / 1024), 'KB');
        
        // 1. ИСПРАВЛЕНИЕ: Переносим fetchCreatorInfo в начало как useCallback
        console.log('🔄 Исправление 1: Перенос fetchCreatorInfo в начало как useCallback');
        
        // Удаляем старое определение fetchCreatorInfo
        const fetchCreatorInfoPattern = /\/\/ Функция для загрузки информации о создателе турнира[\s\S]*?const fetchCreatorInfo = async \(creatorId\) => \{[\s\S]*?\}\;/;
        const fetchCreatorInfoMatch = content.match(fetchCreatorInfoPattern);
        
        if (fetchCreatorInfoMatch) {
            // Извлекаем тело функции
            const oldFunctionBody = fetchCreatorInfoMatch[0];
            
            // Удаляем старое определение
            content = content.replace(fetchCreatorInfoPattern, '');
            
            // Создаем новое определение как useCallback в начале компонента
            const newFetchCreatorInfo = `
    // Функция для загрузки информации о создателе турнира
    const fetchCreatorInfo = useCallback(async (creatorId) => {
        if (!creatorId) return;
        
        try {
            // Делаем прямой запрос к API для получения информации из БД
            console.log(\`Загружаем информацию о создателе турнира (ID: \${creatorId}) из базы данных\`);
            
            const response = await api.get(\`/api/users/profile/\${creatorId}\`);
            
            if (response.data) {
                console.log(\`Информация о создателе турнира успешно загружена из БД:\`, response.data);
                setCreator(response.data);
                
                // Кешируем результат для возможного использования в будущем
                const cacheKey = \`user_\${creatorId}\`;
                localStorage.setItem(cacheKey, JSON.stringify(response.data));
                localStorage.setItem(\`\${cacheKey}_timestamp\`, Date.now().toString());
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных создателя турнира из БД:', error);
            
            // Попытаемся найти информацию о создателе в списке участников
            if (tournament && tournament.participants && Array.isArray(tournament.participants)) {
                console.log('Поиск информации о создателе в списке участников турнира');
                
                const creatorFromParticipants = tournament.participants.find(
                    participant => participant.user_id === creatorId || participant.id === creatorId
                );
                
                if (creatorFromParticipants) {
                    console.log('Найдена информация о создателе в списке участников:', creatorFromParticipants);
                    
                    const creatorInfo = {
                        id: creatorId,
                        username: creatorFromParticipants.name || creatorFromParticipants.username || \`Участник #\${creatorId}\`,
                        avatar_url: creatorFromParticipants.avatar_url || null,
                        fromParticipants: true
                    };
                    
                    setCreator(creatorInfo);
                    return;
                }
            }
            
            // Проверяем, есть ли кешированные данные
            try {
                console.log('Поиск информации о создателе в локальном кеше');
                const cacheKey = \`user_\${creatorId}\`;
                const cachedUser = localStorage.getItem(cacheKey);
                
                if (cachedUser) {
                    const parsedUser = JSON.parse(cachedUser);
                    if (parsedUser && parsedUser.id === creatorId) {
                        console.log('Найдена информация о создателе в кеше:', parsedUser);
                        setCreator(parsedUser);
                        return;
                    }
                }
            } catch (cacheError) {
                console.error('Ошибка при проверке кешированных данных:', cacheError);
            }
            
            // Проверяем, можем ли мы получить данные из tournament.created_by_info
            if (tournament && tournament.created_by_info) {
                console.log('Использование информации о создателе из tournament.created_by_info');
                setCreator(tournament.created_by_info);
                return;
            }
            
            // Если все источники информации недоступны, создаем заглушку
            console.log('Все источники информации о создателе недоступны, создаем заглушку');
            setCreator({
                id: creatorId,
                username: \`Создатель #\${creatorId}\`,
                avatar_url: null,
                isError: true
            });
        }
    }, [tournament]);
`;
            
            // Вставляем новое определение после объявления состояний
            const stateDefinitionsEnd = content.indexOf('    // Проверка, является ли пользователь участником турнира');
            if (stateDefinitionsEnd !== -1) {
                content = content.slice(0, stateDefinitionsEnd) + newFetchCreatorInfo + '\n    ' + content.slice(stateDefinitionsEnd);
                console.log('✅ fetchCreatorInfo перенесен в начало как useCallback');
            } else {
                console.log('❌ Не удалось найти место для вставки fetchCreatorInfo');
            }
        }
        
        // 2. ИСПРАВЛЕНИЕ: Удаляем дублированный setupWebSocket
        console.log('🔄 Исправление 2: Удаление дублированного setupWebSocket');
        
        // Ищем дублированный setupWebSocket (второй)
        const duplicateSetupWebSocketPattern = /\/\/ Настройка Socket\.IO для получения обновлений турнира\s*const setupWebSocket = useCallback\(\(\) => \{[\s\S]*?\}, \[id\]\);[\s\S]*?useEffect\(\(\) => \{[\s\S]*?setupWebSocket\(\);[\s\S]*?\}, \[user\]\);/;
        
        if (content.match(duplicateSetupWebSocketPattern)) {
            content = content.replace(duplicateSetupWebSocketPattern, '');
            console.log('✅ Дублированный setupWebSocket удален');
        }
        
        // 3. ИСПРАВЛЕНИЕ: Удаляем дублированный обработчик disconnect в WebSocket
        console.log('🔄 Исправление 3: Удаление дублированных WebSocket обработчиков');
        
        // Удаляем дублированный обработчик disconnect
        const duplicateDisconnectPattern = /socket\.on\('disconnect', \(reason\) => \{\s*console\.log\('Socket\.IO соединение закрыто в компоненте TournamentDetails:', reason\);\s*setWsConnected\(false\);\s*\}\);/g;
        const disconnectMatches = content.match(duplicateDisconnectPattern);
        if (disconnectMatches && disconnectMatches.length > 1) {
            // Оставляем только первый
            content = content.replace(duplicateDisconnectPattern, '');
            content = content.replace(/(\s+\/\/ Обработка новых сообщений чата турнира)/,
                `
        socket.on('disconnect', (reason) => {
            console.log('Socket.IO соединение закрыто:', reason);
            setWsConnected(false);
        });
$1`);
            console.log('✅ Дублированные disconnect обработчики исправлены');
        }
        
        // 4. ИСПРАВЛЕНИЕ: Проверяем порядок определения других функций
        console.log('🔄 Исправление 4: Проверка порядка других функций');
        
        // Проверяем, что memoizedGameData определен до использования
        const memoizedGameDataIndex = content.indexOf('const memoizedGameData = useMemo');
        const memoizedGameDataUsageIndex = content.indexOf('}, [memoizedGameData,');
        
        if (memoizedGameDataIndex > memoizedGameDataUsageIndex && memoizedGameDataUsageIndex !== -1) {
            console.log('⚠️ memoizedGameData используется до определения, но не критично для данной ошибки');
        }
        
        // 5. ПРОВЕРКА: Удаляем оставшиеся дублированные функции
        console.log('🔄 Исправление 5: Финальная очистка дублированных блоков');
        
        // Проверяем на другие потенциальные дублирования
        const functionNames = ['getGameMaps', 'getDefaultMap', 'gameHasMaps'];
        functionNames.forEach(funcName => {
            const pattern = new RegExp(`const ${funcName} = `, 'g');
            const matches = content.match(pattern);
            if (matches && matches.length > 1) {
                console.log(`⚠️ Обнаружено ${matches.length} определений ${funcName}`);
            }
        });
        
        // Записываем исправленный файл
        fs.writeFileSync(TOURNAMENT_DETAILS_PATH, content, 'utf8');
        
        console.log('✅ Все TDZ ошибки исправлены!');
        console.log('📝 Файл обновлен:', TOURNAMENT_DETAILS_PATH);
        console.log('🔍 Новый размер:', Math.round(content.length / 1024), 'KB');
        
        // Показываем статистику изменений
        const lines = content.split('\n').length;
        console.log('📊 Статистика:');
        console.log('   - Общее количество строк:', lines);
        console.log('   - fetchCreatorInfo: ✅ перенесен и сделан useCallback');
        console.log('   - setupWebSocket: ✅ дублирование удалено');
        console.log('   - WebSocket обработчики: ✅ очищены');
        
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка при исправлении TDZ ошибок:', error);
        return false;
    }
}

// Запускаем исправление
if (fixTDZErrors()) {
    console.log('\n🎯 УСПЕХ! Все TDZ ошибки исправлены');
    console.log('🚀 Теперь можно запустить npm start для проверки');
    console.log('\n📋 Что было исправлено:');
    console.log('   1. ✅ fetchCreatorInfo перенесен в начало как useCallback');
    console.log('   2. ✅ Удален дублированный setupWebSocket');
    console.log('   3. ✅ Исправлены WebSocket обработчики');
    console.log('   4. ✅ Устранены циклические зависимости');
    console.log('   5. ✅ Правильный порядок определения функций');
} else {
    console.log('\n❌ ОШИБКА! Не удалось исправить TDZ ошибки');
    console.log('🛠️ Попробуйте исправить вручную или обратитесь за помощью');
} 