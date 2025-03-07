// tournamentService.js

// Загрузка деталей турнира
export async function loadTournamentDetails(tournamentId) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error('Ошибка загрузки деталей турнира');
        }
        return await response.json();
    } catch (error) {
        console.error('Ошибка загрузки деталей турнира:', error);
        throw error;
    }
}

// Загрузка списка участников
export async function loadParticipants(tournamentId) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/participants?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error('Ошибка загрузки участников');
        }
        const data = await response.json();
        return data.participants || [];
    } catch (error) {
        console.error('Ошибка загрузки участников:', error);
        throw error;
    }
}

// Загрузка матчей (если нужно)
export async function loadMatches(tournamentId) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/matches`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error('Ошибка загрузки матчей');
        }
        return await response.json();
    } catch (error) {
        console.error('Ошибка загрузки матчей:', error);
        throw error;
    }
}