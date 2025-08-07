// 🔍 ДИАГНОСТИЧЕСКИЙ СКРИПТ ДЛЯ КОНСОЛИ БРАУЗЕРА
// Скопируйте и вставьте этот код в консоль браузера на странице турнира

console.log('🔍 ЗАПУСК ДИАГНОСТИКИ ТУРНИРА...\n');

// Получаем данные турнира из React компонента
function getTournamentData() {
    // Ищем React Fiber в DOM элементах
    const tournamentElements = document.querySelectorAll('[class*="tournament"], [class*="Tournament"]');
    
    for (let element of tournamentElements) {
        const reactFiber = element._reactInternalFiber || element._reactInternals;
        if (reactFiber) {
            // Ищем данные турнира в React компонентах
            let current = reactFiber;
            while (current) {
                if (current.memoizedProps && (current.memoizedProps.tournament || current.memoizedProps.matches)) {
                    return {
                        tournament: current.memoizedProps.tournament,
                        matches: current.memoizedProps.matches || current.memoizedProps.tournament?.matches
                    };
                }
                current = current.return;
            }
        }
    }
    
    // Альтернативный поиск через window объекты
    if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
        console.log('🔍 Поиск данных через React internals...');
    }
    
    return null;
}

// Основная диагностическая функция
function diagnoseTournament() {
    const data = getTournamentData();
    
    if (!data || !data.tournament) {
        console.log('❌ Не удалось получить данные турнира из React компонента');
        console.log('💡 Попробуйте запустить скрипт на странице конкретного турнира');
        return;
    }
    
    const { tournament, matches } = data;
    const tournamentMatches = matches || tournament.matches || [];
    
    console.log('🎯 ОСНОВНАЯ ИНФОРМАЦИЯ О ТУРНИРЕ');
    console.log('=' .repeat(50));
    console.log(`📋 Название: ${tournament.name}`);
    console.log(`📊 ID: ${tournament.id}`);
    console.log(`📈 Статус: ${tournament.status}`);
    console.log(`🎮 Формат: ${tournament.format || tournament.bracket_type}`);
    console.log(`👥 Участников: ${tournament.participants?.length || 0}`);
    console.log(`🏆 Команд: ${tournament.teams?.length || 0}`);
    console.log(`⚔️ Матчей: ${tournamentMatches.length}`);
    
    if (tournamentMatches.length === 0) {
        console.log('❌ Нет матчей для анализа');
        return;
    }
    
    // Анализ матчей
    console.log('\n🔍 АНАЛИЗ МАТЧЕЙ');
    console.log('=' .repeat(50));
    
    // Группировка по статусам
    const statusGroups = tournamentMatches.reduce((acc, match) => {
        const status = match.status || 'undefined';
        if (!acc[status]) acc[status] = [];
        acc[status].push(match);
        return acc;
    }, {});
    
    console.log('📊 Матчи по статусам:');
    Object.entries(statusGroups).forEach(([status, matches]) => {
        console.log(`  ${status}: ${matches.length} матчей`);
    });
    
    // Группировка по состояниям (state)
    const stateGroups = tournamentMatches.reduce((acc, match) => {
        const state = match.state || 'undefined';
        if (!acc[state]) acc[state] = [];
        acc[state].push(match);
        return acc;
    }, {});
    
    console.log('\n📊 Матчи по состояниям (state):');
    Object.entries(stateGroups).forEach(([state, matches]) => {
        console.log(`  ${state}: ${matches.length} матчей`);
    });
    
    // Анализ завершенных матчей
    const completedMatches = tournamentMatches.filter(match => {
        const hasValidState = match.state === 'DONE' || match.state === 'SCORE_DONE' || match.status === 'completed';
        const hasScore = (match.score1 !== null && match.score1 !== undefined) || 
                        (match.score2 !== null && match.score2 !== undefined);
        const hasWinner = match.winner_team_id !== null && match.winner_team_id !== undefined;
        
        return hasValidState || hasScore || hasWinner;
    });
    
    console.log(`\n✅ Завершенных матчей: ${completedMatches.length}`);
    
    // Поиск финального матча
    console.log('\n🏆 АНАЛИЗ ФИНАЛЬНОГО МАТЧА');
    console.log('=' .repeat(50));
    
    const finalMatch = tournamentMatches.find(match => 
        match.bracket_type === 'grand_final' || 
        match.is_final === true ||
        (match.round && parseInt(match.round) === Math.max(...tournamentMatches.map(m => parseInt(m.round) || 0)))
    );
    
    if (finalMatch) {
        console.log('🎯 Найден финальный матч:', {
            id: finalMatch.id,
            match_number: finalMatch.match_number,
            round: finalMatch.round,
            bracket_type: finalMatch.bracket_type,
            is_final: finalMatch.is_final,
            status: finalMatch.status,
            state: finalMatch.state,
            team1_id: finalMatch.team1_id,
            team2_id: finalMatch.team2_id,
            winner_team_id: finalMatch.winner_team_id,
            score1: finalMatch.score1,
            score2: finalMatch.score2,
            maps_data: finalMatch.maps_data
        });
        
        // Анализ участников финального матча
        console.log('\n👥 Участники финального матча:');
        
        const getParticipantName = (teamId) => {
            if (!teamId) return 'Не определен';
            
            // Поиск в командах
            if (tournament.teams) {
                const team = tournament.teams.find(t => t.id === teamId);
                if (team) return `${team.name} (Команда ID: ${teamId})`;
            }
            
            // Поиск в участниках
            if (tournament.participants) {
                const participant = tournament.participants.find(p => p.id === teamId);
                if (participant) return `${participant.name || participant.username} (Участник ID: ${teamId})`;
            }
            
            return `Неизвестный (ID: ${teamId})`;
        };
        
        console.log(`  🔵 Команда 1: ${getParticipantName(finalMatch.team1_id)}`);
        console.log(`  🔴 Команда 2: ${getParticipantName(finalMatch.team2_id)}`);
        console.log(`  🏆 Победитель: ${getParticipantName(finalMatch.winner_team_id)}`);
        
    } else {
        console.log('❌ Финальный матч не найден');
        
        // Показываем матчи с максимальным раундом
        const maxRound = Math.max(...tournamentMatches.map(m => parseInt(m.round) || 0));
        const lastRoundMatches = tournamentMatches.filter(m => parseInt(m.round) === maxRound);
        
        console.log(`\n🔍 Матчи последнего раунда (${maxRound}):`);
        lastRoundMatches.forEach((match, index) => {
            console.log(`  Матч ${index + 1}:`, {
                id: match.id,
                bracket_type: match.bracket_type,
                status: match.status,
                winner_team_id: match.winner_team_id
            });
        });
    }
    
    // Анализ всех завершенных матчей
    console.log('\n📋 ВСЕ ЗАВЕРШЕННЫЕ МАТЧИ');
    console.log('=' .repeat(50));
    
    completedMatches.forEach((match, index) => {
        const getParticipantName = (teamId) => {
            if (!teamId) return 'BYE';
            
            if (tournament.teams) {
                const team = tournament.teams.find(t => t.id === teamId);
                if (team) return team.name;
            }
            
            if (tournament.participants) {
                const participant = tournament.participants.find(p => p.id === teamId);
                if (participant) return participant.name || participant.username;
            }
            
            return `ID:${teamId}`;
        };
        
        const winner = getParticipantName(match.winner_team_id);
        const team1 = getParticipantName(match.team1_id);
        const team2 = getParticipantName(match.team2_id);
        
        console.log(`${index + 1}. Матч #${match.match_number || match.id} (${match.bracket_type || 'unknown'}):`, {
            участники: `${team1} vs ${team2}`,
            счет: `${match.score1 || 0}:${match.score2 || 0}`,
            победитель: winner,
            статус: match.status,
            состояние: match.state,
            раунд: match.round,
            карты: match.maps_data ? `${match.maps_data.length} карт` : 'нет данных'
        });
        
        // Детальный анализ карт
        if (match.maps_data && match.maps_data.length > 0) {
            console.log(`    🗺️ Карты:`);
            match.maps_data.forEach((map, mapIndex) => {
                console.log(`      ${mapIndex + 1}. ${map.map_name || 'Неизвестная карта'}: ${map.team1_score || 0}:${map.team2_score || 0}`);
            });
        }
    });
    
    // Проверка на дублирование матчей
    console.log('\n🔍 ПРОВЕРКА НА ПРОБЛЕМЫ');
    console.log('=' .repeat(50));
    
    const duplicateMatches = [];
    const seenPairs = new Set();
    
    completedMatches.forEach(match => {
        const pair1 = `${match.team1_id}-${match.team2_id}`;
        const pair2 = `${match.team2_id}-${match.team1_id}`;
        
        if (seenPairs.has(pair1) || seenPairs.has(pair2)) {
            duplicateMatches.push(match);
        } else {
            seenPairs.add(pair1);
        }
    });
    
    if (duplicateMatches.length > 0) {
        console.log('⚠️ Найдены повторные матчи между теми же командами:');
        duplicateMatches.forEach(match => {
            console.log(`  Матч #${match.match_number}: ${match.team1_id} vs ${match.team2_id}`);
        });
    } else {
        console.log('✅ Дублирующихся матчей не найдено');
    }
    
    // Проверка целостности данных
    const matchesWithoutWinner = completedMatches.filter(m => !m.winner_team_id);
    if (matchesWithoutWinner.length > 0) {
        console.log(`⚠️ Завершенные матчи без победителя: ${matchesWithoutWinner.length}`);
    }
    
    const matchesWithoutScore = completedMatches.filter(m => 
        (m.score1 === null || m.score1 === undefined) && 
        (m.score2 === null || m.score2 === undefined)
    );
    if (matchesWithoutScore.length > 0) {
        console.log(`⚠️ Завершенные матчи без счета: ${matchesWithoutScore.length}`);
    }
    
    console.log('\n🎉 ДИАГНОСТИКА ЗАВЕРШЕНА');
    console.log('💡 Если нужна дополнительная информация, используйте:');
    console.log('   - window.tournamentData = data; // Сохранить данные в глобальную переменную');
    console.log('   - console.table(completedMatches); // Показать матчи в таблице');
    
    // Сохраняем данные для дальнейшего анализа
    window.tournamentData = data;
    window.completedMatches = completedMatches;
    window.finalMatch = finalMatch;
}

// Запуск диагностики
try {
    diagnoseTournament();
} catch (error) {
    console.error('❌ Ошибка при выполнении диагностики:', error);
    console.log('💡 Убедитесь, что вы находитесь на странице турнира');
}