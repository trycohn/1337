// backend/validators/tournament/TournamentValidator.js

class TournamentValidator {
    /**
     * Валидация данных для создания турнира
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

        // Валидация типа участников с поддержкой CS2
        const validParticipantTypes = ['solo', 'team', 'cs2_classic_5v5', 'cs2_wingman_2v2'];
        if (!data.participant_type || !validParticipantTypes.includes(data.participant_type)) {
            errors.push('Неверный тип участников');
        }

        // Специальная валидация для CS2 типов
        if (data.game === 'cs2' && data.format !== 'mix') {
            if (!['cs2_classic_5v5', 'cs2_wingman_2v2'].includes(data.participant_type)) {
                errors.push('Для Counter Strike 2 необходимо выбрать "Классический 5х5" или "Wingman 2х2"');
            }
        }

        // Валидация для не-CS2 игр
        if (data.game !== 'cs2' && data.format !== 'mix') {
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

        // Проверка максимального количества участников
        if (data.max_participants !== null && data.max_participants !== undefined) {
            const maxParticipants = parseInt(data.max_participants);
            if (isNaN(maxParticipants) || maxParticipants < 2 || maxParticipants > 1000) {
                errors.push('Максимальное количество участников должно быть числом от 2 до 1000');
            }
        }

        // Проверка размера команды для mix-турниров
        if (data.format === 'mix') {
            if (!data.team_size || ![2, 5].includes(parseInt(data.team_size))) {
                errors.push('Для mix-турниров размер команды должен быть 2 или 5');
            }
        }

        // Проверка даты начала
        if (data.start_date) {
            const startDate = new Date(data.start_date);
            if (isNaN(startDate.getTime())) {
                errors.push('Неверная дата начала турнира');
            } else if (startDate < new Date()) {
                errors.push('Дата начала турнира не может быть в прошлом');
            }
        }

        // Проверка описания
        if (data.description && data.description.length > 1000) {
            errors.push('Описание не должно превышать 1000 символов');
        }

        // Проверка типа сетки
        if (data.bracket_type) {
            const allowedBracketTypes = ['single_elimination', 'double_elimination'];
            if (!allowedBracketTypes.includes(data.bracket_type)) {
                errors.push('Неверный тип сетки. Допустимые: single_elimination, double_elimination');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация данных для обновления турнира
     */
    static validateUpdateTournament(data) {
        const errors = [];

        // Проверяем только переданные поля
        if (data.name !== undefined) {
            if (!data.name || data.name.trim().length === 0) {
                errors.push('Название турнира не может быть пустым');
            } else if (data.name.trim().length < 3) {
                errors.push('Название турнира должно содержать минимум 3 символа');
            } else if (data.name.trim().length > 100) {
                errors.push('Название турнира не должно превышать 100 символов');
            }
        }

        if (data.game !== undefined && (!data.game || data.game.trim().length === 0)) {
            errors.push('Игра не может быть пустой');
        }

        if (data.format !== undefined) {
            const allowedFormats = ['single', 'mix'];
            if (!allowedFormats.includes(data.format)) {
                errors.push('Неверный формат турнира');
            }
        }

        if (data.participant_type !== undefined) {
            const allowedParticipantTypes = ['solo', 'team'];
            if (!allowedParticipantTypes.includes(data.participant_type)) {
                errors.push('Неверный тип участников');
            }
        }

        if (data.max_participants !== undefined && data.max_participants !== null) {
            const maxParticipants = parseInt(data.max_participants);
            if (isNaN(maxParticipants) || maxParticipants < 2 || maxParticipants > 1000) {
                errors.push('Максимальное количество участников должно быть числом от 2 до 1000');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация данных участия в турнире
     */
    static validateParticipation(data) {
        const errors = [];

        // Для командных турниров проверяем наличие teamId или newTeamName
        if (data.teamId && data.newTeamName) {
            errors.push('Укажите либо существующую команду, либо создайте новую');
        }

        if (data.newTeamName !== undefined) {
            if (!data.newTeamName || data.newTeamName.trim().length === 0) {
                errors.push('Название команды не может быть пустым');
            } else if (data.newTeamName.trim().length < 2) {
                errors.push('Название команды должно содержать минимум 2 символа');
            } else if (data.newTeamName.trim().length > 50) {
                errors.push('Название команды не должно превышать 50 символов');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация результата матча
     */
    static validateMatchResult(data) {
        const errors = [];

        // Проверяем winner_team_id (новый формат) или winnerTeamId (старый формат)
        const winnerId = data.winner_team_id || data.winnerTeamId;
        if (!winnerId) {
            errors.push('Необходимо указать команду-победителя (winner_team_id)');
        } else {
            const winnerIdNum = parseInt(winnerId);
            if (isNaN(winnerIdNum) || winnerIdNum <= 0) {
                errors.push('ID команды-победителя должен быть положительным числом');
            }
        }

        // Проверяем score1
        if (data.score1 !== undefined && data.score1 !== null) {
            const score1 = parseInt(data.score1);
            if (isNaN(score1) || score1 < 0) {
                errors.push('Счет первой команды должен быть неотрицательным числом');
            }
        }

        // Проверяем score2
        if (data.score2 !== undefined && data.score2 !== null) {
            const score2 = parseInt(data.score2);
            if (isNaN(score2) || score2 < 0) {
                errors.push('Счет второй команды должен быть неотрицательным числом');
            }
        }

        // Проверяем matchId если он передан
        if (data.matchId !== undefined) {
            const matchId = parseInt(data.matchId);
            if (isNaN(matchId) || matchId <= 0) {
                errors.push('ID матча должен быть положительным числом');
            }
        }

        // Проверка данных карт (maps_data или maps)
        const mapsData = data.maps_data || data.maps || data.mapsData;
        if (mapsData) {
            if (!Array.isArray(mapsData)) {
                errors.push('Данные карт должны быть массивом');
            } else {
                mapsData.forEach((map, index) => {
                    // Проверяем название карты (разные варианты полей)
                    const mapName = map.mapName || map.map_name || map.name || map.map;
                    if (!mapName || mapName.trim().length === 0) {
                        errors.push(`Название карты ${index + 1} обязательно`);
                    }
                    
                    // Проверяем счет первой команды (разные варианты полей)
                    const team1Score = map.team1Score || map.score1;
                    if (team1Score !== undefined && team1Score !== null) {
                        const score = parseInt(team1Score);
                        if (isNaN(score) || score < 0) {
                            errors.push(`Счет первой команды на карте ${index + 1} должен быть неотрицательным числом`);
                        }
                    }
                    
                    // Проверяем счет второй команды (разные варианты полей)
                    const team2Score = map.team2Score || map.score2;
                    if (team2Score !== undefined && team2Score !== null) {
                        const score = parseInt(team2Score);
                        if (isNaN(score) || score < 0) {
                            errors.push(`Счет второй команды на карте ${index + 1} должен быть неотрицательным числом`);
                        }
                    }
                });
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация ID турнира
     */
    static validateTournamentId(id) {
        const tournamentId = parseInt(id);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return {
                isValid: false,
                errors: ['Неверный ID турнира']
            };
        }

        return {
            isValid: true,
            errors: [],
            value: tournamentId
        };
    }

    /**
     * Валидация ID пользователя
     */
    static validateUserId(id) {
        const userId = parseInt(id);
        if (isNaN(userId) || userId <= 0) {
            return {
                isValid: false,
                errors: ['Неверный ID пользователя']
            };
        }

        return {
            isValid: true,
            errors: [],
            value: userId
        };
    }

    /**
     * Валидация строки (общая функция)
     */
    static validateString(value, fieldName, required = true, minLength = 0, maxLength = 1000) {
        const errors = [];

        if (required && (!value || value.trim().length === 0)) {
            errors.push(`${fieldName} обязательно`);
        } else if (value) {
            if (value.trim().length < minLength) {
                errors.push(`${fieldName} должно содержать минимум ${minLength} символов`);
            }
            if (value.trim().length > maxLength) {
                errors.push(`${fieldName} не должно превышать ${maxLength} символов`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            value: value ? value.trim() : value
        };
    }

    /**
     * Валидация ответа на запрос администрирования
     */
    static validateAdminResponse(data) {
        const errors = [];

        if (!data.requesterId) {
            errors.push('ID запрашивающего обязателен');
        } else {
            const requesterId = parseInt(data.requesterId);
            if (isNaN(requesterId) || requesterId <= 0) {
                errors.push('Неверный ID запрашивающего');
            }
        }

        if (!data.action) {
            errors.push('Действие обязательно');
        } else if (!['accept', 'reject'].includes(data.action)) {
            errors.push('Действие должно быть "accept" или "reject"');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация приглашения администратора
     */
    static validateAdminInvitation(data) {
        const errors = [];

        if (!data.inviteeId) {
            errors.push('ID приглашаемого обязателен');
        } else {
            const inviteeId = parseInt(data.inviteeId);
            if (isNaN(inviteeId) || inviteeId <= 0) {
                errors.push('Неверный ID приглашаемого');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация добавления участника
     */
    static validateAddParticipant(data) {
        const errors = [];

        if (!data.participantName || data.participantName.trim().length === 0) {
            errors.push('Имя участника обязательно');
        } else if (data.participantName.trim().length < 2) {
            errors.push('Имя участника должно содержать минимум 2 символа');
        } else if (data.participantName.trim().length > 50) {
            errors.push('Имя участника не должно превышать 50 символов');
        }

        if (data.userId) {
            const userId = parseInt(data.userId);
            if (isNaN(userId) || userId <= 0) {
                errors.push('Неверный ID пользователя');
            }
        }

        if (data.faceit_elo) {
            const faceItElo = parseInt(data.faceit_elo);
            if (isNaN(faceItElo) || faceItElo < 0 || faceItElo > 10000) {
                errors.push('FACEIT ELO должен быть числом от 0 до 10000');
            }
        }

        if (data.cs2_premier_rank) {
            const premierRank = parseInt(data.cs2_premier_rank);
            if (isNaN(premierRank) || premierRank < 1 || premierRank > 40000) {
                errors.push('CS2 Premier ранг должен быть числом от 1 до 40000');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Валидация приглашения в турнир
     */
    static validateInvitation(data) {
        const errors = [];

        if (!data.username && !data.email) {
            errors.push('Необходимо указать никнейм или email');
        }

        if (data.username && (data.username.trim().length < 3 || data.username.trim().length > 50)) {
            errors.push('Никнейм должен содержать от 3 до 50 символов');
        }

        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Неверный формат email');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // 🔧 АЛИАСЫ ДЛЯ КОНСИСТЕНТНОСТИ API

    /**
     * Алиас для validateCreateTournament
     */
    static validateCreate(data) {
        return this.validateCreateTournament(data);
    }

    /**
     * Алиас для validateUpdateTournament
     */
    static validateUpdate(data) {
        return this.validateUpdateTournament(data);
    }
}

module.exports = TournamentValidator; 