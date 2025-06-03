# PowerShell скрипт для исправления TDZ ошибки в TournamentDetails.js
Write-Host "🔧 Исправление TDZ ошибки fetchCreatorInfo..."

$filePath = "frontend/src/components/TournamentDetails.js"

# Читаем содержимое файла
$content = Get-Content $filePath -Raw -Encoding UTF8

# Находим определение fetchCreatorInfo и удаляем его из исходного места
$fetchCreatorInfoPattern = '    // Функция для загрузки информации о создателе турнира \(КРИТИЧНО: определяем ПЕРЕД использованием\)[\s\S]*?    \}, \[tournament\]\);'
$fetchCreatorInfoDefinition = [regex]::Match($content, $fetchCreatorInfoPattern).Value

if ($fetchCreatorInfoDefinition) {
    Write-Host "Найдено определение fetchCreatorInfo, перемещаем..."
    
    # Удаляем старое определение
    $content = $content -replace [regex]::Escape($fetchCreatorInfoDefinition), ''
    
    # Вставляем определение после checkParticipation
    $insertionPoint = '    \}, \[tournament\?\.participants, user\?\.id\]\);'
    $newDefinition = @"
    }, [tournament?.participants, user?.id]);
    
    // Функция для загрузки информации о создателе турнира (ИСПРАВЛЕНО: определяем ПЕРЕД использованием)
    const fetchCreatorInfo = useCallback(async (creatorId) => {
        if (!creatorId) return;
        
        try {
            console.log(`Загружаем информацию о создателе турнира (ID: ${creatorId}) из базы данных`);
            const response = await api.get(`/api/users/profile/${creatorId}`);
            
            if (response.data) {
                console.log(`Информация о создателе турнира успешно загружена из БД:`, response.data);
                setCreator(response.data);
                
                const cacheKey = `user_${creatorId}`;
                localStorage.setItem(cacheKey, JSON.stringify(response.data));
                localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
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
                        username: creatorFromParticipants.name || creatorFromParticipants.username || `Участник #${creatorId}`,
                        avatar_url: creatorFromParticipants.avatar_url || null,
                        fromParticipants: true
                    };
                    setCreator(creatorInfo);
                    return;
                }
            }
            
            setCreator({
                id: creatorId,
                username: `Создатель #${creatorId}`,
                avatar_url: null,
                isError: true
            });
        }
    }, [tournament]);
"@
    
    $content = $content -replace $insertionPoint, $newDefinition
    
    # Записываем исправленный файл
    $content | Set-Content $filePath -Encoding UTF8NoBOM
    
    Write-Host "✅ TDZ ошибка исправлена! fetchCreatorInfo перемещена в правильное место."
} else {
    Write-Host "❌ Не удалось найти определение fetchCreatorInfo для перемещения."
}

Write-Host "🚀 Теперь попробуйте запустить: npm start" 