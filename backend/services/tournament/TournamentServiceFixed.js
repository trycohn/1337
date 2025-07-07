/**
 * Исправленный метод updateRules для TournamentService
 * 
 * Этот файл содержит исправление для TournamentService.js
 * Нужно заменить метод updateRules в оригинальном файле
 */

// 🔧 ИСПРАВЛЕННЫЙ МЕТОД:
static async updateRules(tournamentId, rules, userId) {
    console.log(`⚖️ TournamentService: Обновление регламента турнира ${tournamentId}`);

    await this._checkTournamentAccess(tournamentId, userId);

    // 🔧 ИСПРАВЛЕНО: Убрана проверка статуса турнира
    // Регламент можно редактировать в любом статусе турнира (active, completed, in_progress)
    // Только проверяем права доступа
    
    return await TournamentRepository.updateRules(tournamentId, rules);
}

// Инструкция:
// Замените метод updateRules в backend/services/tournament/TournamentService.js
// на код выше, убрав строки:
// 
// const tournament = await TournamentRepository.getById(tournamentId);
// if (tournament.status !== 'active') {
//     throw new Error('Турнир неактивен');
// } 