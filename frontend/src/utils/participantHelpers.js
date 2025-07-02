/**
 * Получение информации об участнике или команде по ID
 * @param {number} teamId - ID команды или участника
 * @param {Object} tournament - Объект турнира с участниками и командами
 * @returns {Object|null} Информация об участнике/команде или null
 */
export const getParticipantInfo = (teamId, tournament) => {
    if (!teamId || !tournament) return null;

    // Проверяем команды
    if (tournament.teams) {
        const team = tournament.teams.find(t => t.id === teamId);
        if (team) {
            return {
                id: teamId,
                name: team.name,
                avatar_url: team.members?.[0]?.avatar_url || null,
                members: team.members || []
            };
        }
    }

    // Проверяем участников
    if (tournament.participants) {
        const participant = tournament.participants.find(p => p.id === teamId);
        if (participant) {
            return {
                id: teamId,
                name: participant.name || participant.username,
                avatar_url: participant.avatar_url,
                members: []
            };
        }
    }

    return null;
};

/**
 * Обогащение данных матча названиями команд и составами
 * @param {Object} match - Объект матча
 * @param {Object} tournament - Объект турнира
 * @returns {Object} Обогащенный объект матча
 */
export const enrichMatchWithParticipantNames = (match, tournament) => {
    if (!match || !tournament) return match;

    const team1Info = getParticipantInfo(match.team1_id, tournament);
    const team2Info = getParticipantInfo(match.team2_id, tournament);

    return {
        ...match,
        team1_name: team1Info?.name || 'TBD',
        team2_name: team2Info?.name || 'TBD',
        team1_composition: team1Info || null,
        team2_composition: team2Info || null
    };
};

/**
 * Валидация данных участника
 * @param {Object} participant - Объект участника
 * @returns {boolean} Результат валидации
 */
export const validateParticipantData = (participant) => {
    if (!participant || typeof participant !== 'object') {
        return false;
    }
    return participant.id && (participant.name || participant.username);
}; 