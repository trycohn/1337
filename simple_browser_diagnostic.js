// 🔍 ПРОСТОЙ ДИАГНОСТИЧЕСКИЙ СКРИПТ
// Вставьте этот код в консоль браузера на странице турнира

console.log('🔍 ПРОСТАЯ ДИАГНОСТИКА ТУРНИРА');
console.log('=' .repeat(40));

// Попытка получить данные из различных источников
function findTournamentData() {
    // 1. Поиск в React DevTools
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log('🔍 React DevTools обнаружены');
    }
    
    // 2. Поиск в глобальных переменных
    const globalVars = ['tournament', 'tournamentData', 'matches', 'currentTournament'];
    for (const varName of globalVars) {
        if (window[varName]) {
            console.log(`✅ Найдена глобальная переменная: ${varName}`);
            return window[varName];
        }
    }
    
    // 3. Поиск через DOM элементы с data-атрибутами
    const elementsWithData = document.querySelectorAll('[data-tournament], [data-matches], [data-tournament-id]');
    if (elementsWithData.length > 0) {
        console.log(`🔍 Найдено ${elementsWithData.length} элементов с data-атрибутами`);
        for (const el of elementsWithData) {
            console.log('  Элемент:', el.tagName, el.className);
            if (el.dataset.tournament) {
                try {
                    return JSON.parse(el.dataset.tournament);
                } catch (e) {
                    console.log('  ❌ Ошибка парсинга JSON');
                }
            }
        }
    }
    
    // 4. Поиск в localStorage/sessionStorage
    const storageKeys = ['tournament', 'tournamentData', 'currentTournament'];
    for (const key of storageKeys) {
        const data = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (data) {
            try {
                console.log(`✅ Найдены данные в storage: ${key}`);
                return JSON.parse(data);
            } catch (e) {
                console.log(`❌ Ошибка парсинга данных из ${key}`);
            }
        }
    }
    
    return null;
}

// Анализ URL для получения ID турнира
function getTournamentIdFromUrl() {
    const url = window.location.href;
    const matches = url.match(/tournament[s]?\/(\d+)/i);
    if (matches) {
        const tournamentId = parseInt(matches[1]);
        console.log(`🔍 ID турнира из URL: ${tournamentId}`);
        return tournamentId;
    }
    return null;
}

// Основная функция диагностики
function runDiagnosis() {
    console.log(`📍 Текущая страница: ${window.location.href}`);
    
    const tournamentId = getTournamentIdFromUrl();
    if (tournamentId) {
        console.log(`🎯 Турнир ID: ${tournamentId}`);
    }
    
    // Поиск данных турнира
    const tournamentData = findTournamentData();
    
    if (!tournamentData) {
        console.log('❌ Данные турнира не найдены автоматически');
        console.log('\n💡 РУЧНАЯ ДИАГНОСТИКА:');
        console.log('1. Откройте вкладку Elements в DevTools');
        console.log('2. Найдите элемент с классом содержащим "tournament"');
        console.log('3. В консоли выполните: $0._reactInternalFiber или $0._reactInternals');
        console.log('4. Или попробуйте: Object.keys(window).filter(key => key.includes("tournament"))');
        
        // Показываем доступные глобальные переменные
        const windowKeys = Object.keys(window).filter(key => 
            key.toLowerCase().includes('tournament') || 
            key.toLowerCase().includes('match') ||
            key.toLowerCase().includes('react')
        );
        
        if (windowKeys.length > 0) {
            console.log('\n🔍 Потенциально полезные переменные в window:');
            windowKeys.forEach(key => console.log(`  - window.${key}`));
        }
        
        return;
    }
    
    // Анализ найденных данных
    console.log('\n✅ ДАННЫЕ ТУРНИРА НАЙДЕНЫ');
    console.log('=' .repeat(40));
    
    if (tournamentData.tournament) {
        const t = tournamentData.tournament;
        console.log(`📋 Название: ${t.name || 'Не указано'}`);
        console.log(`📊 ID: ${t.id || 'Не указан'}`);
        console.log(`📈 Статус: ${t.status || 'Не указан'}`);
        console.log(`🎮 Формат: ${t.format || t.bracket_type || 'Не указан'}`);
        
        const matches = t.matches || tournamentData.matches || [];
        console.log(`⚔️ Всего матчей: ${matches.length}`);
        
        if (matches.length > 0) {
            // Анализ статусов
            const statuses = {};
            const states = {};
            let withWinners = 0;
            let withScores = 0;
            
            matches.forEach(match => {
                statuses[match.status || 'undefined'] = (statuses[match.status || 'undefined'] || 0) + 1;
                states[match.state || 'undefined'] = (states[match.state || 'undefined'] || 0) + 1;
                
                if (match.winner_team_id) withWinners++;
                if (match.score1 !== null && match.score1 !== undefined || 
                    match.score2 !== null && match.score2 !== undefined) withScores++;
            });
            
            console.log('\n📊 Статистика матчей:');
            console.log('  По статусам:', statuses);
            console.log('  По состояниям:', states);
            console.log(`  С победителями: ${withWinners}`);
            console.log(`  Со счетом: ${withScores}`);
            
            // Поиск финального матча
            const finalCandidates = matches.filter(match => 
                match.bracket_type === 'grand_final' || 
                match.is_final === true ||
                match.bracket_type === 'final' ||
                (match.round && parseInt(match.round) === Math.max(...matches.map(m => parseInt(m.round) || 0)))
            );
            
            console.log(`\n🏆 Кандидаты в финальные матчи: ${finalCandidates.length}`);
            finalCandidates.forEach((match, index) => {
                console.log(`  ${index + 1}. Матч #${match.match_number || match.id}:`, {
                    bracket_type: match.bracket_type,
                    round: match.round,
                    status: match.status,
                    winner: match.winner_team_id ? `ID:${match.winner_team_id}` : 'Нет'
                });
            });
        }
    }
    
    // Сохраняем данные для дальнейшего анализа
    window.diagnosisData = tournamentData;
    console.log('\n💾 Данные сохранены в window.diagnosisData');
    console.log('💡 Используйте console.table(window.diagnosisData.tournament.matches) для таблицы матчей');
}

// Запуск диагностики
try {
    runDiagnosis();
} catch (error) {
    console.error('❌ Ошибка диагностики:', error);
    console.log('💡 Попробуйте обновить страницу и запустить скрипт снова');
}

// Дополнительные утилиты
console.log('\n🛠️ ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ:');
console.log('• Object.keys(window).filter(k => k.includes("tournament")) - поиск переменных');
console.log('• document.querySelectorAll("[class*=tournament]") - поиск элементов');
console.log('• JSON.stringify(window.diagnosisData, null, 2) - вывод данных в JSON');