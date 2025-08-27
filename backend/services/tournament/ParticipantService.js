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
     * 🆕 ОТПРАВКА СПЕЦИАЛЬНЫХ WEBSOCKET СОБЫТИЙ ДЛЯ УЧАСТНИКОВ
     */
    static async _broadcastParticipantUpdate(tournamentId, action, participantData, userId = null) {
        console.log(`🎯 [_broadcastParticipantUpdate] Начинаем отправку WebSocket события`);
        console.log(`📊 Параметры:`, {
            tournamentId: parseInt(tournamentId),
            action,
            participantData,
            userId
        });
        
        try {
            // Получаем io из глобального объекта или server
            const io = global.io || require('../../socketio-server').getIO();
            
            console.log(`🔌 Socket.IO instance найден:`, !!io);
            
            if (io) {
                const updateData = {
                    tournamentId: parseInt(tournamentId),
                    action: action, // 'added', 'removed', 'updated'
                    participant: participantData,
                    timestamp: new Date().toISOString(),
                    userId: userId
                };
                
                console.log(`📡 Отправляем событие participant_update:`, updateData);
                
                // Отправляем специальное событие для оптимизированного обновления участников
                io.emit('participant_update', updateData);
                
                console.log(`✅ Событие participant_update отправлено успешно`);
                console.log(`🎯 Специальное событие participant_update отправлено: ${action} участника ${participantData.name || participantData.id}`);
            } else {
                console.error(`❌ Socket.IO instance не найден!`);
                console.warn('⚠️ Socket.IO instance не найден для отправки participant_update');
            }
        } catch (error) {
            console.error('❌ Ошибка отправки WebSocket события participant_update:', error);
            console.error('Stack trace:', error.stack);
        }
    }

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

        // 🆕 Проверяем требования привязок для MIX турниров
        if (tournament.format === 'mix') {
            try {
                const pool = require('../../db');
                const userResult = await pool.query('SELECT id, steam_id, faceit_id FROM users WHERE id = $1', [userId]);
                const user = userResult.rows[0] || {};

                const needsFaceit = !!tournament.require_faceit_linked && (tournament.mix_rating_type === 'faceit');
                const needsSteam = !!tournament.require_steam_linked && (tournament.mix_rating_type === 'premier');

                if (needsFaceit && !user.faceit_id) {
                    const err = new Error('Для участия требуется привязать FACEIT аккаунт');
                    err.code = 'FACEIT_LINK_REQUIRED';
                    throw err;
                }

                if (needsSteam && !user.steam_id) {
                    const err = new Error('Для участия требуется привязать Steam аккаунт');
                    err.code = 'STEAM_LINK_REQUIRED';
                    throw err;
                }
            } catch (checkErr) {
                // Пробрасываем дальше; фронтенд покажет кнопки привязки
                throw checkErr;
            }
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

        // 🆕 Отправляем специальное WebSocket событие
        await this._broadcastParticipantUpdate(tournamentId, 'removed', participant, userId);

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

        // 🆕 Отправляем специальное WebSocket событие
        await this._broadcastParticipantUpdate(tournamentId, 'removed', removedParticipant, adminUserId);

        console.log('✅ ParticipantService: Участник удален администратором');
        return removedParticipant;
    }

    /**
     * Обработка участия в одиночном турнире
     */
    static async _handleSoloParticipation(tournament, userId, username) {
        console.log(`👤 [ParticipantService] Обработка одиночного участия пользователя ${userId} в турнире ${tournament.id}`);

        // Добавляем участника в турнир
        const participant = await ParticipantRepository.create({
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

        // 🆕 Отправляем специальное WebSocket событие
        await this._broadcastParticipantUpdate(tournament.id, 'added', participant, userId);
        
        return participant;
    }

    /**
     * 🆕 Обработка участия в командном турнире (включая CS2)
     */
    static async _handleTeamParticipation(tournament, userId, username, options) {
        console.log(`👥 [ParticipantService] Обработка командного участия пользователя ${userId} в турнире ${tournament.id}`);
        console.log(`📋 Опции:`, options);
        
        // Проверяем минимальный размер команды для CS2
        const minTeamSize = this._getMinTeamSize(tournament.participant_type);
        
        if (options.teamId) {
            // 🆕 ИСПРАВЛЕНО: Сначала ищем в пользовательских командах
            await this._joinOrCreateFromUserTeam(tournament, userId, username, options.teamId, minTeamSize);
        } else if (options.newTeamName) {
            await this._createNewTeam(tournament, userId, username, options.newTeamName, minTeamSize);
        } else {
            throw new Error('Для командного турнира необходимо указать команду или создать новую');
        }
    }

    /**
     * 🆕 Присоединение к команде или создание турнирной команды на основе пользовательской
     */
    static async _joinOrCreateFromUserTeam(tournament, userId, username, teamId, minTeamSize = 1) {
        const pool = require('../../db');
        
        // Сначала проверяем, есть ли команда в турнирных командах
        const tournamentTeam = await TeamRepository.getById(teamId);
        
        if (tournamentTeam && tournamentTeam.tournament_id === tournament.id) {
            // Это уже турнирная команда - присоединяемся напрямую
            return await this._joinExistingTournamentTeam(tournament, userId, username, teamId, minTeamSize);
        }
        
        // Ищем в пользовательских командах
        const userTeamResult = await pool.query('SELECT * FROM user_teams WHERE id = $1', [teamId]);
        const userTeam = userTeamResult.rows[0];
        
        if (!userTeam) {
            throw new Error('Команда не найдена');
        }
        
        // Проверяем, что пользователь является участником этой команды
        const memberResult = await pool.query(
            'SELECT * FROM user_team_members WHERE team_id = $1 AND user_id = $2', 
            [teamId, userId]
        );
        
        if (memberResult.rows.length === 0) {
            throw new Error('Вы не являетесь участником этой команды');
        }
        
        // Проверяем, не создана ли уже турнирная команда на основе этой пользовательской команды
        const existingTournamentTeamResult = await pool.query(
            'SELECT * FROM tournament_teams WHERE tournament_id = $1 AND name = $2',
            [tournament.id, userTeam.name]
        );
        
        if (existingTournamentTeamResult.rows.length > 0) {
            // Турнирная команда уже существует - присоединяемся к ней
            const existingTeam = existingTournamentTeamResult.rows[0];
            return await this._joinExistingTournamentTeam(tournament, userId, username, existingTeam.id, minTeamSize);
        }
        
        // Создаем новую турнирную команду на основе пользовательской
        console.log(`🆕 Создаем турнирную команду "${userTeam.name}" на основе пользовательской команды ${teamId}`);
        
        const tournamentTeamData = await TeamRepository.create({
            tournament_id: tournament.id,
            name: userTeam.name,
            creator_id: userTeam.captain_id
        });
        
        // Добавляем всех участников пользовательской команды в турнирную команду
        const userTeamMembersResult = await pool.query(`
            SELECT utm.*, u.username 
            FROM user_team_members utm 
            JOIN users u ON utm.user_id = u.id 
            WHERE utm.team_id = $1
        `, [teamId]);
        
        for (const member of userTeamMembersResult.rows) {
            // Создаем участника турнира
            const participant = await ParticipantRepository.create({
                tournament_id: tournament.id,
                user_id: member.user_id,
                name: member.username
            });
            
            // Добавляем в турнирную команду
            await TeamRepository.addMember(
                tournamentTeamData.id, 
                member.user_id, 
                participant.id,
                member.role === 'captain' // is_captain
            );
        }
        
        await logTournamentEvent(tournament.id, userId, 'team_imported_from_user_team', {
            user_team_id: teamId,
            tournament_team_id: tournamentTeamData.id,
            team_name: userTeam.name,
            members_count: userTeamMembersResult.rows.length
        });

        await sendTournamentChatAnnouncement(
            tournament.id,
            `🏆 Команда "${userTeam.name}" присоединилась к турниру! (${userTeamMembersResult.rows.length} участников)`
        );
    }

    /**
     * Присоединение к существующей турнирной команде
     */
    static async _joinExistingTournamentTeam(tournament, userId, username, teamId, minTeamSize = 1) {
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

        // Проверяем, не является ли пользователь уже участником команды
        const existingMemberResult = await pool.query(
            'SELECT * FROM tournament_team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, userId]
        );
        
        if (existingMemberResult.rows.length > 0) {
            throw new Error('Вы уже являетесь участником этой команды');
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
        console.log(`📋 Данные участника:`, participantData);
        
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
        
        console.log(`✅ Участник создан в базе данных:`, newParticipant);
        
        // Логируем событие
        await logTournamentEvent(tournamentId, adminUserId, 'participant_added', {
            participantId: newParticipant.id,
            participantName: participantName,
            addedByAdmin: true
        });
        
        console.log(`📝 Событие турнира зарегистрировано: participant_added`);
        
        // 🆕 Отправляем специальное WebSocket событие
        console.log(`📡 Отправляем WebSocket событие participant_update с данными:`, {
            tournamentId,
            action: 'added',
            participant: newParticipant,
            adminUserId
        });
        
        await this._broadcastParticipantUpdate(tournamentId, 'added', newParticipant, adminUserId);
        
        console.log(`✅ Участник ${participantName} добавлен в турнир ${tournamentId}`);
        return newParticipant;
    }
}

module.exports = ParticipantService;