// Минимальный диагностический код (наберите вручную)

// 1. Поиск данных турнира
const url = window.location.href;
const tournamentId = url.match(/tournament[s]?\/(\d+)/i)?.[1];
console.log('Tournament ID:', tournamentId);

// 2. Поиск в глобальных переменных
const keys = Object.keys(window).filter(k => k.toLowerCase().includes('tournament'));
console.log('Tournament variables:', keys);

// 3. Поиск элементов турнира
const elements = document.querySelectorAll('[class*="tournament"], [class*="Tournament"]');
console.log('Tournament elements found:', elements.length);

// 4. Если есть элементы - ищем React данные
if (elements.length > 0) {
    const el = elements[0];
    const fiber = el._reactInternalFiber || el._reactInternals;
    if (fiber) {
        console.log('React fiber found');
        let current = fiber;
        while (current && !current.memoizedProps?.tournament) {
            current = current.return;
        }
        if (current?.memoizedProps?.tournament) {
            window.t = current.memoizedProps.tournament;
            console.log('Tournament data saved to window.t');
            console.log('Name:', window.t.name);
            console.log('Status:', window.t.status);
            console.log('Matches:', window.t.matches?.length || 0);
        }
    }
}

// 5. Показать что найдено
console.log('Use window.t to access tournament data');