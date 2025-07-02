/**
 * Валидатор для операций с турнирами
 * Централизованная валидация всех входящих данных
 */

class TournamentValidator {
    /**
     * Валидация данных для создания турнира
     */
    static validateCreateTournament(data) {
        const errors = [];
        
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 3) {
            errors.push('Название турнира должно содержать минимум 3 символа');
        }
        
        if (!data.game || typeof data.game !== 'string') {
            errors.push('Укажите игру для турнира');
        }
        
        if (!data.format || !['single_elimination', 'double_elimination', 'round_robin', 'mix'].includes(data.format)) {
            errors.push('Укажите корректный формат турнира');
        }
        
        if (!data.participant_type || !['solo', 'team'].includes(data.participant_type)) {
            errors.push('Укажите корректный тип участников');
        }
        
        if (data.max_participants && (!Number.isInteger(data.max_participants) || data.max_participants < 2)) {
            errors.push('Максимальное количество участников должно быть числом больше 1');
        }
        
        if (data.team_size && (!Number.isInteger(data.team_size) || data.team_size < 1)) {
            errors.push('Размер команды должен быть положительным числом');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация данных для формирования команд
     */
    static validateFormTeamsRequest(data) {
        const errors = [];
        
        if (!data.tournamentId || !Number.isInteger(data.tournamentId) || data.tournamentId <= 0) {
            errors.push('Некорректный ID турнира');
        }
        
        if (!data.ratingType || !['faceit', 'premier'].includes(data.ratingType)) {
            errors.push('Некорректный тип рейтинга (должен быть faceit или premier)');
        }
        
        if (!data.userId || !Number.isInteger(data.userId) || data.userId <= 0) {
            errors.push('Некорректный ID пользователя');
        }
        
        if (data.teamSize !== undefined) {
            const teamSize = parseInt(data.teamSize);
            if (!Number.isInteger(teamSize) || teamSize < 2 || teamSize > 10) {
                errors.push('Размер команды должен быть числом от 2 до 10');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация данных для обновления результата матча
     */
    static validateMatchResult(data) {
        const errors = [];
        
        if (!data.matchId || !Number.isInteger(data.matchId) || data.matchId <= 0) {
            errors.push('Некорректный ID матча');
        }
        
        if (!data.winner_team_id || !Number.isInteger(data.winner_team_id) || data.winner_team_id <= 0) {
            errors.push('Укажите победителя матча');
        }
        
        if (data.score1 !== undefined && (!Number.isInteger(data.score1) || data.score1 < 0)) {
            errors.push('Счет первой команды должен быть неотрицательным числом');
        }
        
        if (data.score2 !== undefined && (!Number.isInteger(data.score2) || data.score2 < 0)) {
            errors.push('Счет второй команды должен быть неотрицательным числом');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация данных для генерации турнирной сетки
     */
    static validateGenerateBracket(data) {
        const errors = [];
        
        if (!data.tournamentId || !Number.isInteger(data.tournamentId) || data.tournamentId <= 0) {
            errors.push('Некорректный ID турнира');
        }
        
        if (!data.userId || !Number.isInteger(data.userId) || data.userId <= 0) {
            errors.push('Некорректный ID пользователя');
        }
        
        if (data.thirdPlaceMatch !== undefined && typeof data.thirdPlaceMatch !== 'boolean') {
            errors.push('Параметр матча за 3-е место должен быть булевым значением');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация данных для добавления участника
     */
    static validateAddParticipant(data) {
        const errors = [];
        
        if (!data.tournamentId || !Number.isInteger(data.tournamentId) || data.tournamentId <= 0) {
            errors.push('Некорректный ID турнира');
        }
        
        if (!data.participantName || typeof data.participantName !== 'string' || data.participantName.trim().length < 2) {
            errors.push('Имя участника должно содержать минимум 2 символа');
        }
        
        if (data.userId && (!Number.isInteger(data.userId) || data.userId <= 0)) {
            errors.push('Некорректный ID пользователя');
        }
        
        if (data.faceit_elo && (!Number.isInteger(data.faceit_elo) || data.faceit_elo < 0 || data.faceit_elo > 5000)) {
            errors.push('FACEIT ELO должен быть числом от 0 до 5000');
        }
        
        if (data.cs2_premier_rank && (!Number.isInteger(data.cs2_premier_rank) || data.cs2_premier_rank < 1 || data.cs2_premier_rank > 40)) {
            errors.push('CS2 Premier ранг должен быть числом от 1 до 40');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация общих параметров турнира
     */
    static validateTournamentUpdate(data) {
        const errors = [];
        
        if (data.name && (typeof data.name !== 'string' || data.name.trim().length < 3)) {
            errors.push('Название турнира должно содержать минимум 3 символа');
        }
        
        if (data.description && typeof data.description !== 'string') {
            errors.push('Описание должно быть строкой');
        }
        
        if (data.rules && typeof data.rules !== 'string') {
            errors.push('Регламент должен быть строкой');
        }
        
        if (data.prize_pool && (typeof data.prize_pool !== 'string' || data.prize_pool.trim().length === 0)) {
            errors.push('Призовой фонд должен быть непустой строкой');
        }
        
        if (data.start_date && !this._isValidDate(data.start_date)) {
            errors.push('Некорректная дата начала турнира');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация размера команды
     */
    static validateTeamSize(teamSize) {
        const errors = [];
        
        if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 10) {
            errors.push('Размер команды должен быть числом от 1 до 10');
        }
        
        if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(teamSize)) {
            errors.push('Размер команды должен быть целым числом');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Проверка корректности даты
     */
    static _isValidDate(dateString) {
        try {
            const date = new Date(dateString);
            return date instanceof Date && !isNaN(date.getTime());
        } catch (error) {
            return false;
        }
    }

    /**
     * Валидация ID
     */
    static validateId(id, fieldName = 'ID') {
        const errors = [];
        
        if (!id || !Number.isInteger(id) || id <= 0) {
            errors.push(`Некорректный ${fieldName}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация разрешений пользователя
     */
    static validateUserPermissions(data) {
        const errors = [];
        
        if (!data.userId || !Number.isInteger(data.userId) || data.userId <= 0) {
            errors.push('Некорректный ID пользователя');
        }
        
        if (!data.tournamentId || !Number.isInteger(data.tournamentId) || data.tournamentId <= 0) {
            errors.push('Некорректный ID турнира');
        }
        
        if (data.action && typeof data.action !== 'string') {
            errors.push('Некорректное действие');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = { TournamentValidator }; 