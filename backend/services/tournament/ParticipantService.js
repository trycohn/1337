const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { sendTournamentEventNotification } = require('../../utils/tournament/chatHelpers');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const { broadcastTournamentUpdate } = require('../../notifications');

class ParticipantService {
    /**
     * Участие в турнире
     */
    static async participateInTournament(tournamentId, userId, username, options = {}) {
        console.log(`👥 ParticipantService: Участие в турнире ${tournamentId} пользователя ${userId}`);

        // Получаем информацию о турнире
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.status !== 'active') {
            throw new Error('Турнир не активен');
        }

        // Проверяем, не участвует ли уже пользователь
        const existingParticipant = await ParticipantRepository.getUserParticipation(tournamentId, userId);
        if (existingParticipant) {
            throw new Error('Вы уже участвуете в этом турнире');
        }

        // Проверяем лимит участников
        if (tournament.max_participants) {
            const currentCount = await ParticipantRepository.getCountByTournamentId(tournamentId);
            if (currentCount >= tournament.max_participants) {
                throw new Error('Турнир заполнен');
            }
        }

        // Обработка разных типов турниров
        if (tournament.participant_type === 'team') {
            return await this._handleTeamParticipation(tournament, userId, username, options);
        } else {
            return await this._handleSoloParticipation(tournament, userId, username);
        }
    }

    /**
     * Отмена участия в турнире
     */
    static async cancelParticipation(tournamentId, userId, username) {
        console.log(`❌ ParticipantService: Отмена участия в турнире ${tournamentId} пользователя ${userId}`);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.status !== 'active') {
            throw new Error('Нельзя отменить участие в неактивном турнире');
        }

        // Проверяем участие пользователя
        const participant = await ParticipantRepository.getUserParticipation(tournamentId, userId);
        if (!participant) {
            throw new Error('Вы не участвуете в этом турнире');
        }

        // Удаляем участника
        await ParticipantRepository.removeParticipant(tournamentId, userId);

        // Логируем событие
        await logTournamentEvent(tournamentId, userId, 'participant_left', {
            participantName: username
        });

        // Уведомление в чат
        await sendTournamentEventNotification(tournamentId, 'participant_left', {
            participantName: username
        });

        // Обновляем данные турнира через WebSocket
        const updatedTournament = await TournamentRepository.getByIdWithCreator(tournamentId);
        broadcastTournamentUpdate(tournamentId, updatedTournament);

        console.log('✅ ParticipantService: Участие отменено');
    }

    /**
     * Получение участников турнира
     */
    static async getParticipants(tournamentId) {
        return await ParticipantRepository.getByTournamentId(tournamentId);
    }

    /**
     * Получение участников турнира (алиас для совместимости)
     */
    static async getByTournamentId(tournamentId) {
        return await this.getParticipants(tournamentId);
    }

    /**
     * Получение оригинальных участников турнира (включая тех, кто не в командах)
     */
    static async getOriginalParticipants(tournamentId) {
        console.log(`👥 ParticipantService: Получение оригинальных участников турнира ${tournamentId}`);
        
        const participants = await ParticipantRepository.getByTournamentId(tournamentId);
        
        // Разделяем участников на группы
        const allParticipants = participants;
        const inTeam = participants.filter(p => p.in_team);
        const notInTeam = participants.filter(p => !p.in_team);
        
        console.log(`📊 Статистика участников: всего ${allParticipants.length}, в командах ${inTeam.length}, не в командах ${notInTeam.length}`);
        
        return {
            all: allParticipants,
            inTeam: inTeam,
            notInTeam: notInTeam,
            total: allParticipants.length,
            inTeamCount: inTeam.length,
            notInTeamCount: notInTeam.length
        };
    }

    /**
     * Удаление участника (для администраторов)
     */
    static async removeParticipant(tournamentId, participantId, adminUserId) {
        console.log(`🛡️ ParticipantService: Удаление участника ${participantId} из турнира ${tournamentId}`);

        // Проверка прав администратора
        await this._checkAdminAccess(tournamentId, adminUserId);

        const tournament = await TournamentRepository.getById(tournamentId);
        if (tournament.status !== 'active') {
            throw new Error('Нельзя удалить участника из неактивного турнира');
        }

        // Удаляем участника
        const removedParticipant = await ParticipantRepository.removeById(participantId);
        if (!removedParticipant) {
            throw new Error('Участник не найден');
        }

        // Логируем событие
        await logTournamentEvent(tournamentId, adminUserId, 'participant_removed_by_admin', {
            removedParticipantId: participantId,
            removedParticipantName: removedParticipant.name
        });

        console.log('✅ ParticipantService: Участник удален администратором');
        return removedParticipant;
    }

    /**
     * Обработка участия в одиночном турнире
     */
    static async _handleSoloParticipation(tournament, userId, username) {
        console.log(`👤 [ParticipantService] Обработка одиночного участия пользователя ${userId} в турнире ${tournament.id}`);

        // Добавляем участника в турнир
        await ParticipantRepository.create({
            tournament_id: tournament.id,
            user_id: userId,
            name: username
        });

        await logTournamentEvent(tournament.id, userId, 'participant_joined', {
            participant_name: username,
            tournament_name: tournament.name
        });

        await sendTournamentChatAnnouncement(
            tournament.id,
            `🎮 ${username} присоединился к турниру!`
        );
    }

    /**
     * 🆕 Обработка участия в командном турнире (включая CS2)
     */
    static async _handleTeamParticipation(tournament, userId, username, options) {
        console.log(`👥 [ParticipantService] Обработка командного участия пользователя ${userId} в турнире ${tournament.id}`);
        
        // Проверяем минимальный размер команды для CS2
        const minTeamSize = this._getMinTeamSize(tournament.participant_type);
        
        if (options.teamId) {
            await this._joinExistingTeam(tournament, userId, username, options.teamId, minTeamSize);
        } else if (options.newTeamName) {
            await this._createNewTeam(tournament, userId, username, options.newTeamName, minTeamSize);
        } else {
            throw new Error('Для командного турнира необходимо указать команду или создать новую');
        }
    }

    /**
     * 🆕 Получить минимальный размер команды в зависимости от типа участников
     */
    static _getMinTeamSize(participantType) {
        const minSizes = {
            'cs2_classic_5v5': 5,
            'cs2_wingman_2v2': 2,
            'team': 1, // Стандартные командные турниры
            'solo': 1
        };
        return minSizes[participantType] || 1;
    }

    /**
     * 🆕 Получить максимальный размер команды в зависимости от типа участников
     */
    static _getMaxTeamSize(participantType) {
        const maxSizes = {
            'cs2_classic_5v5': 10,
            'cs2_wingman_2v2': 4,
            'team': 10, // Стандартные командные турниры
            'solo': 1
        };
        return maxSizes[participantType] || 10;
    }

    /**
     * Присоединение к существующей команде
     */
    static async _joinExistingTeam(tournament, userId, username, teamId, minTeamSize = 1) {
        const team = await TeamRepository.getById(teamId);
        
        if (!team || team.tournament_id !== tournament.id) {
            throw new Error('Команда не найдена в этом турнире');
        }

        const membersCount = await TeamRepository.getMembersCount(teamId);
        const maxTeamSize = this._getMaxTeamSize(tournament.participant_type);
        
        if (membersCount >= maxTeamSize) {
            const typeName = this._getTypeDisplayName(tournament.participant_type);
            throw new Error(`Команда заполнена (максимум ${maxTeamSize} участников для ${typeName})`);
        }

        // Создаем участника турнира
        const participant = await ParticipantRepository.create({
            tournament_id: tournament.id,
            user_id: userId,
            name: username
        });

        // Добавляем в команду
        await TeamRepository.addMember(teamId, userId, participant.id);

        await logTournamentEvent(tournament.id, userId, 'participant_joined_team', {
            participant_name: username,
            team_name: team.name,
            team_id: teamId
        });

        await sendTournamentChatAnnouncement(
            tournament.id,
            `👥 ${username} присоединился к команде "${team.name}"!`
        );
    }

    /**
     * Создание новой команды
     */
    static async _createNewTeam(tournament, userId, username, teamName, minTeamSize = 1) {
        const maxTeamSize = this._getMaxTeamSize(tournament.participant_type);
        
        // Создаем команду
        const team = await TeamRepository.create({
            tournament_id: tournament.id,
            name: teamName,
            creator_id: userId
        });

        // Создаем участника турнира
        const participant = await ParticipantRepository.create({
            tournament_id: tournament.id,
            user_id: userId,
            name: username
        });

        // Добавляем создателя в команду
        await TeamRepository.addMember(team.id, userId, participant.id);

        const typeName = this._getTypeDisplayName(tournament.participant_type);

        await logTournamentEvent(tournament.id, userId, 'team_created', {
            team_name: teamName,
            team_id: team.id,
            creator_name: username,
            min_team_size: minTeamSize,
            max_team_size: maxTeamSize
        });

        await sendTournamentChatAnnouncement(
            tournament.id,
            `🏆 ${username} создал команду "${teamName}" для ${typeName}! Минимум участников: ${minTeamSize}`
        );
    }

    /**
     * 🆕 Получить отображаемое название типа участников
     */
    static _getTypeDisplayName(participantType) {
        const names = {
            'cs2_classic_5v5': 'Классический 5х5',
            'cs2_wingman_2v2': 'Wingman 2х2',
            'team': 'командного турнира',
            'solo': 'одиночного турнира'
        };
        return names[participantType] || participantType;
    }

    /**
     * Проверка прав доступа администратора
     * @private
     */
    static async _checkAdminAccess(tournamentId, userId) {
        const tournament = await TournamentRepository.getById(tournamentId);
        if (!tournament) {
            throw new Error('Турнир не найден');
        }

        if (tournament.created_by !== userId) {
            const isAdmin = await TournamentRepository.isAdmin(tournamentId, userId);
            if (!isAdmin) {
                throw new Error('Только создатель или администратор турнира может выполнить это действие');
            }
        }
    }

    /**
     * Ручное добавление участника в турнир (для администраторов)
     */
    static async addParticipant(tournamentId, adminUserId, participantData) {
        console.log(`➕ ParticipantService: Добавление участника в турнир ${tournamentId} администратором ${adminUserId}`);
        
        // Проверяем права доступа
        await this._checkAdminAccess(tournamentId, adminUserId);
        
        const { participantName, userId, faceit_elo, cs2_premier_rank } = participantData;
        
        if (!participantName) {
            throw new Error('Укажите имя участника');
        }
        
        // Проверяем, не участвует ли уже пользователь (если указан userId)
        if (userId) {
            const existingParticipant = await ParticipantRepository.getUserParticipation(tournamentId, userId);
            if (existingParticipant) {
                throw new Error('Этот пользователь уже участвует в турнире');
            }
        }
        
        // Создаем участника
        const newParticipant = await ParticipantRepository.create({
            tournament_id: tournamentId,
            user_id: userId || null,
            name: participantName,
            faceit_elo: faceit_elo || null,
            cs2_premier_rank: cs2_premier_rank || null
        });
        
        // Логируем событие
        await logTournamentEvent(tournamentId, adminUserId, 'participant_added', {
            participantId: newParticipant.id,
            participantName: participantName,
            addedByAdmin: true
        });
        
        console.log(`✅ Участник ${participantName} добавлен в турнир ${tournamentId}`);
        return newParticipant;
    }

    /**
     * Генерация команд для микс-турнира (заглушка)
     */
    static async generateMixTeams(tournamentId, userId, username, ratingType = 'faceit') {
        console.log(`🎲 ParticipantService: Генерация команд для микс-турнира ${tournamentId} пользователем ${username}`);
        
        // Проверяем права доступа
        await this._checkAdminAccess(tournamentId, userId);
        
        // TODO: Реализовать логику генерации команд для микс-турниров
        // Это сложная функция, которая должна:
        // 1. Получить всех участников турнира
        // 2. Разделить их по рейтингу
        // 3. Создать сбалансированные команды
        // 4. Обновить тип турнира на командный
        
        throw new Error('Генерация команд для микс-турниров временно недоступна. Используйте старый интерфейс.');
    }
}

module.exports = ParticipantService; 