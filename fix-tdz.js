const fs = require('fs');
const path = require('path');

console.log('🔧 Исправление TDZ ошибки fetchCreatorInfo...');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

// Читаем файл
let content = fs.readFileSync(filePath, 'utf8');

// Удаляем Unicode BOM если есть
content = content.replace(/^\uFEFF/, '');

// Ищем определение fetchCreatorInfo
const fetchCreatorInfoMatch = content.match(/(    \/\/ Функция для загрузки информации о создателе турнира[\s\S]*?    \}, \[tournament\]\);)/);

if (fetchCreatorInfoMatch) {
    const fetchCreatorInfoDefinition = fetchCreatorInfoMatch[1];
    console.log('Найдено определение fetchCreatorInfo');
    
    // Удаляем старое определение
    content = content.replace(fetchCreatorInfoDefinition, '');
    
    // Ищем место для вставки (после checkParticipation)
    const insertionPoint = content.indexOf('    }, [tournament?.participants, user?.id]);');
    
    if (insertionPoint !== -1) {
        const insertAfter = insertionPoint + '    }, [tournament?.participants, user?.id]);'.length;
        
        // Вставляем определение
        const newDefinition = `
    
    // Функция для загрузки информации о создателе турнира (ИСПРАВЛЕНО: определяем ПЕРЕД использованием)
    const fetchCreatorInfo = useCallback(async (creatorId) => {
        if (!creatorId) return;
        
        try {
            console.log(\`Загружаем информацию о создателе турнира (ID: \${creatorId}) из базы данных\`);
            const response = await api.get(\`/api/users/profile/\${creatorId}\`);
            
            if (response.data) {
                console.log(\`Информация о создателе турнира успешно загружена из БД:\`, response.data);
                setCreator(response.data);
                
                const cacheKey = \`user_\${creatorId}\`;
                localStorage.setItem(cacheKey, JSON.stringify(response.data));
                localStorage.setItem(\`\${cacheKey}_timestamp\`, Date.now().toString());
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных создателя турнира из БД:', error);
            
            if (tournament && tournament.participants && Array.isArray(tournament.participants)) {
                const creatorFromParticipants = tournament.participants.find(
                    participant => participant.user_id === creatorId || participant.id === creatorId
                );
                
                if (creatorFromParticipants) {
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
            
            setCreator({
                id: creatorId,
                username: \`Создатель #\${creatorId}\`,
                avatar_url: null,
                isError: true
            });
        }
    }, [tournament]);`;
        
        content = content.slice(0, insertAfter) + newDefinition + content.slice(insertAfter);
        
        // Записываем файл
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log('✅ TDZ ошибка исправлена! fetchCreatorInfo перемещена в правильное место.');
    } else {
        console.error('❌ Не удалось найти место для вставки');
    }
} else {
    console.error('❌ Не удалось найти определение fetchCreatorInfo');
}

console.log('🚀 Исправление завершено. Попробуйте открыть страницу турнира.'); 