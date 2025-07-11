/**
 * 🎯 Валидатор турниров
 * Центральный валидатор для проверки данных турниров
 */

class TournamentValidator {
    
    /**
     * Валидация данных создания турнира
     */
    static validateCreateTournament(data) {
        const errors = [];

        // Валидация названия
        if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 3) {
            errors.push('Название турнира должно содержать минимум 3 символа');
        }

        if (data.name && data.name.length > 100) {
            errors.push('Название турнира не может превышать 100 символов');
        }

        // Валидация игры
        if (!data.game || typeof data.game !== 'string') {
            errors.push('Необходимо выбрать игру');
        }

        // Валидация формата
        const validFormats = ['single', 'double', 'mix'];
        if (!data.format || !validFormats.includes(data.format)) {
            errors.push('Неверный формат турнира');
        }

        // 🆕 ОБНОВЛЕННАЯ ВАЛИДАЦИЯ: поддержка CS2 типов участников
        const validParticipantTypes = ['solo', 'team', 'cs2_classic_5v5', 'cs2_wingman_2v2'];
        if (!data.participant_type || !validParticipantTypes.includes(data.participant_type)) {
            errors.push('Неверный тип участников');
        }

        // Специальная валидация для CS2 типов
        if (data.game === 'Counter-Strike 2' && data.format !== 'mix') {
            if (!['cs2_classic_5v5', 'cs2_wingman_2v2'].includes(data.participant_type)) {
                errors.push('Для Counter Strike 2 необходимо выбрать "Классический 5х5" или "Wingman 2х2"');
            }
        }

        // Валидация для не-CS2 игр
        if (data.game !== 'Counter-Strike 2' && data.format !== 'mix') {
            if (!['team', 'solo'].includes(data.participant_type)) {
                errors.push('Для данной игры доступны только типы "Командный" или "Одиночный"');
            }
        }

        // Валидация размера команды для CS2
        if (data.participant_type === 'cs2_classic_5v5' && data.team_size && data.team_size < 5) {
            errors.push('Классический формат CS2 требует минимум 5 игроков в команде');
        }

        if (data.participant_type === 'cs2_wingman_2v2' && data.team_size && data.team_size < 2) {
            errors.push('Wingman формат CS2 требует минимум 2 игрока в команде');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация запроса на формирование команд
     */
    static validateFormTeamsRequest(data) {
        const errors = [];

        // Валидация tournament ID
        if (!data.tournamentId || typeof data.tournamentId !== 'number' || data.tournamentId <= 0) {
            errors.push('Некорректный ID турнира');
        }

        // Валидация user ID
        if (!data.userId || typeof data.userId !== 'number' || data.userId <= 0) {
            errors.push('Некорректный ID пользователя');
        }

        // 🆕 ОБНОВЛЕННАЯ ВАЛИДАЦИЯ: поддержка рейтинга для команд в зависимости от типа
        if (data.ratingType && !['faceit', 'premier', 'mixed'].includes(data.ratingType)) {
            errors.push('Неверный тип рейтинга. Допустимые: faceit, premier, mixed');
        }

        // Валидация размера команды
        if (data.teamSize !== undefined && data.teamSize !== null) {
            if (typeof data.teamSize !== 'number' || ![2, 3, 4, 5].includes(data.teamSize)) {
                errors.push('Размер команды должен быть числом от 2 до 5');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 🆕 Валидация типа участников с поддержкой CS2
     */
    static validateParticipantType(participantType, game, format) {
        const errors = [];

        // Для микс турниров только solo
        if (format === 'mix' && participantType !== 'solo') {
            errors.push('Для микс турниров доступен только тип "Одиночный"');
            return { isValid: false, errors };
        }

        // Для CS2 турниров
        if (game === 'Counter-Strike 2' && format !== 'mix') {
            const validCS2Types = ['cs2_classic_5v5', 'cs2_wingman_2v2'];
            if (!validCS2Types.includes(participantType)) {
                errors.push('Для Counter Strike 2 доступны только типы "Классический 5х5" и "Wingman 2х2"');
            }
        }

        // Для остальных игр
        if (game !== 'Counter-Strike 2' && format !== 'mix') {
            const validStandardTypes = ['team', 'solo'];
            if (!validStandardTypes.includes(participantType)) {
                errors.push('Для данной игры доступны только типы "Командный" и "Одиночный"');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 🆕 Получить минимальный размер команды для типа участников
     */
    static getMinTeamSize(participantType) {
        const minSizes = {
            'cs2_classic_5v5': 5,
            'cs2_wingman_2v2': 2,
            'team': 1,
            'solo': 1
        };
        return minSizes[participantType] || 1;
    }

    /**
     * 🆕 Получить максимальный размер команды для типа участников
     */
    static getMaxTeamSize(participantType) {
        const maxSizes = {
            'cs2_classic_5v5': 10,
            'cs2_wingman_2v2': 4,
            'team': 10,
            'solo': 1
        };
        return maxSizes[participantType] || 10;
    }

    /**
     * 🆕 Получить отображаемое имя типа участников
     */
    static getParticipantTypeDisplayName(participantType) {
        const names = {
            'cs2_classic_5v5': 'Классический 5х5',
            'cs2_wingman_2v2': 'Wingman 2х2',
            'team': 'Командный',
            'solo': 'Одиночный'
        };
        return names[participantType] || participantType;
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