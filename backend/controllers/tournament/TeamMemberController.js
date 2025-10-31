const TournamentRepository = require('../../repositories/tournament/TournamentRepository');
const TeamRepository = require('../../repositories/tournament/TeamRepository');
const ParticipantRepository = require('../../repositories/tournament/ParticipantRepository');
const { logTournamentEvent } = require('../../utils/tournament/logger');
const { asyncHandler } = require('../../utils/asyncHandler');
const pool = require('../../db');

/**
 * Контроллер для управления составом команд турнира
 */
class TeamMemberController {
    /**
     * Добавить участника в команду
     */
    static addTeamMember = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId } = req.params;
        const { participantId, userId, nickname } = req.body;

        console.log('➕ [TeamMemberController] Добавление участника в команду:', {
            tournamentId,
            teamId,
            participantId,
            userId,
            nickname
        });

        // Проверка турнира
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверка прав доступа
        const isCreator = tournament.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, req.user.id]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может управлять составом команд' });
            }
        }

        // Проверка команды
        const team = await TeamRepository.getById(parseInt(teamId));
        if (!team || team.tournament_id !== parseInt(tournamentId)) {
            return res.status(404).json({ error: 'Команда не найдена в этом турнире' });
        }

        // Проверяем что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Нельзя изменять состав после начала турнира' });
        }

        // Проверяем лимит участников команды
        const currentMembers = await pool.query(
            'SELECT COUNT(*) as count FROM tournament_team_members WHERE team_id = $1',
            [teamId]
        );
        const membersCount = parseInt(currentMembers.rows[0].count);
        const maxTeamSize = tournament.team_size || 5;

        if (membersCount >= maxTeamSize) {
            return res.status(400).json({ error: `Команда заполнена (максимум ${maxTeamSize} участников)` });
        }

        let participant;

        // Вариант 1: Добавляем существующего участника турнира
        if (participantId) {
            participant = await ParticipantRepository.getById(parseInt(participantId));
            if (!participant || participant.tournament_id !== parseInt(tournamentId)) {
                return res.status(404).json({ error: 'Участник не найден в этом турнире' });
            }

            // Проверяем что участник не в другой команде
            if (participant.in_team) {
                return res.status(400).json({ error: 'Участник уже состоит в другой команде' });
            }

            // Добавляем в команду
            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                [teamId, participant.user_id, participantId]
            );

            // Обновляем флаг in_team
            await ParticipantRepository.updateInTeamStatus([participantId], true);
            
            // Если участник был в листе ожидания - убираем оттуда
            if (participant.in_waiting_list) {
                await pool.query(
                    'UPDATE tournament_participants SET in_waiting_list = FALSE WHERE id = $1',
                    [participantId]
                );
            }
        }
        // Вариант 2: Добавляем зарегистрированного пользователя
        else if (userId) {
            // Проверяем что пользователь существует
            const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (userCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            // Создаем участника турнира
            participant = await ParticipantRepository.create({
                tournament_id: parseInt(tournamentId),
                user_id: userId,
                name: userCheck.rows[0].username
            });

            // Добавляем в команду
            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                [teamId, userId, participant.id]
            );

            // Обновляем флаг in_team
            await ParticipantRepository.updateInTeamStatus([participant.id], true);
        }
        // Вариант 3: Добавляем незарегистрированного игрока
        else if (nickname && nickname.trim()) {
            // Создаем незарегистрированного участника
            participant = await ParticipantRepository.create({
                tournament_id: parseInt(tournamentId),
                user_id: null,
                name: nickname.trim()
            });

            // Добавляем в команду (без user_id для незарегистрированных)
            await pool.query(
                'INSERT INTO tournament_team_members (team_id, user_id, participant_id) VALUES ($1, $2, $3)',
                [teamId, null, participant.id]
            );

            // Обновляем флаг in_team
            await ParticipantRepository.updateInTeamStatus([participant.id], true);
        } else {
            return res.status(400).json({ error: 'Укажите участника для добавления' });
        }

        // Логируем событие
        await logTournamentEvent(parseInt(tournamentId), req.user.id, 'team_member_added', {
            teamId: parseInt(teamId),
            teamName: team.name,
            participantId: participant.id,
            participantName: participant.name
        });

        res.json({ 
            success: true,
            message: 'Участник добавлен в команду',
            participant
        });
    });

    /**
     * Удалить участника из команды
     */
    static removeTeamMember = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId, participantId } = req.params;

        console.log('🗑️ [TeamMemberController] Удаление участника из команды:', {
            tournamentId,
            teamId,
            participantId
        });

        // Проверка турнира
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверка прав доступа
        const isCreator = tournament.created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            const adminCheck = await pool.query(
                'SELECT * FROM tournament_admins WHERE tournament_id = $1 AND user_id = $2',
                [tournamentId, req.user.id]
            );
            if (adminCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Только создатель или администратор может управлять составом команд' });
            }
        }

        // Проверяем что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Нельзя изменять состав после начала турнира' });
        }

        // Получаем участника
        const participant = await ParticipantRepository.getById(parseInt(participantId));
        if (!participant) {
            return res.status(404).json({ error: 'Участник не найден' });
        }

        // Удаляем из команды
        await pool.query(
            'DELETE FROM tournament_team_members WHERE team_id = $1 AND participant_id = $2',
            [teamId, participantId]
        );

        // Обновляем флаг in_team
        await ParticipantRepository.updateInTeamStatus([participantId], false);

        // Логируем событие
        await logTournamentEvent(parseInt(tournamentId), req.user.id, 'team_member_removed', {
            teamId: parseInt(teamId),
            participantId: parseInt(participantId),
            participantName: participant.name
        });

        res.json({ 
            success: true,
            message: 'Участник удален из команды'
        });
    });

    /**
     * Получить состав команды
     */
    static getTeamMembers = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId } = req.params;

        // Получаем участников команды
        const result = await pool.query(`
            SELECT 
                tp.id,
                tp.name,
                tp.user_id,
                tp.faceit_elo,
                tp.cs2_premier_rank,
                u.username,
                u.avatar_url,
                u.faceit_elo as user_faceit_elo,
                u.cs2_premier_rank as user_cs2_premier_rank,
                ttm.is_captain
            FROM tournament_team_members ttm
            JOIN tournament_participants tp ON ttm.participant_id = tp.id
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE ttm.team_id = $1
            ORDER BY ttm.is_captain DESC, tp.name ASC
        `, [teamId]);

        res.json({ 
            success: true,
            members: result.rows
        });
    });

    /**
     * 🆕 Получить доступных игроков из глобальной команды капитана
     */
    static getGlobalTeamRoster = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId } = req.params;
        const userId = req.user.id;

        console.log('🔍 [TeamMemberController] Получение глобального ростера:', {
            tournamentId,
            teamId,
            userId
        });

        // Проверка турнира
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверка что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Редактирование доступно только для активных турниров' });
        }

        // Проверка турнирной команды
        const tournamentTeam = await pool.query(
            'SELECT * FROM tournament_teams WHERE id = $1 AND tournament_id = $2',
            [teamId, tournamentId]
        );

        if (tournamentTeam.rows.length === 0) {
            return res.status(404).json({ error: 'Команда не найдена в турнире' });
        }

        // Проверка что пользователь - капитан команды
        const captainCheck = await pool.query(
            'SELECT * FROM tournament_team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = true',
            [teamId, userId]
        );

        if (captainCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан может редактировать состав команды' });
        }

        // Ищем глобальную команду где пользователь - капитан
        const globalTeam = await pool.query(
            'SELECT * FROM user_teams WHERE captain_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (globalTeam.rows.length === 0) {
            return res.json({ 
                success: true,
                globalTeam: null,
                availablePlayers: [],
                message: 'У вас нет глобальной команды'
            });
        }

        const globalTeamId = globalTeam.rows[0].id;

        // Получаем всех участников глобальной команды
        const globalMembers = await pool.query(`
            SELECT 
                u.id as user_id,
                u.username,
                u.avatar_url,
                u.faceit_elo,
                u.cs2_premier_rank,
                utm.role,
                (utm.role = 'captain') as is_captain
            FROM user_team_members utm
            JOIN users u ON u.id = utm.user_id
            WHERE utm.team_id = $1
            ORDER BY (utm.role = 'captain') DESC, u.username ASC
        `, [globalTeamId]);

        // Получаем текущий турнирный состав
        const tournamentRoster = await pool.query(`
            SELECT tp.user_id
            FROM tournament_team_members ttm
            JOIN tournament_participants tp ON ttm.participant_id = tp.id
            WHERE ttm.team_id = $1 AND tp.user_id IS NOT NULL
        `, [teamId]);

        const tournamentUserIds = new Set(tournamentRoster.rows.map(r => r.user_id));

        // Фильтруем доступных игроков (те, кого еще нет в турнирной команде)
        const availablePlayers = globalMembers.rows.filter(player => !tournamentUserIds.has(player.user_id));

        console.log('✅ [TeamMemberController] Найдено игроков:', {
            globalTeamId,
            totalInGlobal: globalMembers.rows.length,
            alreadyInTournament: tournamentUserIds.size,
            available: availablePlayers.length
        });

        res.json({ 
            success: true,
            globalTeam: {
                id: globalTeamId,
                name: globalTeam.rows[0].name,
                avatar_url: globalTeam.rows[0].avatar_url
            },
            availablePlayers,
            currentRosterCount: tournamentUserIds.size,
            maxTeamSize: tournament.team_size || 5
        });
    });

    /**
     * 🆕 Обновить турнирный состав команды (только для капитана)
     */
    static updateTeamRoster = asyncHandler(async (req, res) => {
        const { id: tournamentId, teamId } = req.params;
        const { memberUserIds } = req.body; // Массив user_id которые должны быть в команде
        const userId = req.user.id;

        console.log('🔄 [TeamMemberController] Обновление турнирного состава:', {
            tournamentId,
            teamId,
            userId,
            newRoster: memberUserIds
        });

        if (!Array.isArray(memberUserIds)) {
            return res.status(400).json({ error: 'Некорректные данные состава' });
        }

        // Проверка турнира
        const tournament = await TournamentRepository.getById(parseInt(tournamentId));
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }

        // Проверка что турнир активен
        if (tournament.status !== 'active') {
            return res.status(400).json({ error: 'Редактирование доступно только для активных турниров' });
        }

        // Проверка лимита team_size
        const maxTeamSize = tournament.team_size || 5;
        if (memberUserIds.length > maxTeamSize) {
            return res.status(400).json({ error: `Максимальный размер команды: ${maxTeamSize}` });
        }

        // Проверка что пользователь - капитан команды
        const captainCheck = await pool.query(
            'SELECT * FROM tournament_team_members WHERE team_id = $1 AND user_id = $2 AND is_captain = true',
            [teamId, userId]
        );

        if (captainCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Только капитан может редактировать состав команды' });
        }

        // Начинаем транзакцию
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Получаем текущий состав (кроме капитана)
            const currentRoster = await client.query(`
                SELECT ttm.participant_id, tp.user_id, tp.name
                FROM tournament_team_members ttm
                JOIN tournament_participants tp ON ttm.participant_id = tp.id
                WHERE ttm.team_id = $1 AND ttm.is_captain = false
            `, [teamId]);

            const currentUserIds = currentRoster.rows.map(r => r.user_id).filter(Boolean);

            // 2. Определяем кого нужно удалить (есть сейчас, но нет в новом составе)
            const toRemove = currentRoster.rows.filter(r => r.user_id && !memberUserIds.includes(r.user_id));

            // 3. Определяем кого нужно добавить (есть в новом составе, но нет сейчас)
            const toAdd = memberUserIds.filter(uid => !currentUserIds.includes(uid));

            console.log('🔄 [TeamMemberController] Операции:', {
                toRemove: toRemove.length,
                toAdd: toAdd.length
            });

            // 4. Удаляем участников
            for (const member of toRemove) {
                await client.query(
                    'DELETE FROM tournament_team_members WHERE team_id = $1 AND participant_id = $2',
                    [teamId, member.participant_id]
                );
                
                // Обновляем флаг in_team
                await client.query(
                    'UPDATE tournament_participants SET in_team = false WHERE id = $1',
                    [member.participant_id]
                );

                console.log(`➖ Удален: ${member.name}`);
            }

            // 5. Добавляем новых участников
            for (const newUserId of toAdd) {
                // Проверяем существует ли пользователь
                const userCheck = await client.query('SELECT * FROM users WHERE id = $1', [newUserId]);
                if (userCheck.rows.length === 0) {
                    console.warn(`⚠️ Пользователь ${newUserId} не найден, пропускаем`);
                    continue;
                }

                // Проверяем существует ли участник турнира для этого пользователя
                let participant = await client.query(
                    'SELECT * FROM tournament_participants WHERE tournament_id = $1 AND user_id = $2',
                    [tournamentId, newUserId]
                );

                let participantId;

                if (participant.rows.length > 0) {
                    // Участник уже существует
                    participantId = participant.rows[0].id;
                    
                    // Проверяем что он не в другой команде
                    if (participant.rows[0].in_team) {
                        console.warn(`⚠️ Пользователь ${userCheck.rows[0].username} уже в другой команде`);
                        continue;
                    }
                } else {
                    // Создаем нового участника турнира
                    const newParticipant = await client.query(
                        'INSERT INTO tournament_participants (tournament_id, user_id, name) VALUES ($1, $2, $3) RETURNING id',
                        [tournamentId, newUserId, userCheck.rows[0].username]
                    );
                    participantId = newParticipant.rows[0].id;
                }

                // Добавляем в турнирную команду
                await client.query(
                    'INSERT INTO tournament_team_members (team_id, user_id, participant_id, is_captain) VALUES ($1, $2, $3, false)',
                    [teamId, newUserId, participantId]
                );

                // Обновляем флаг in_team
                await client.query(
                    'UPDATE tournament_participants SET in_team = true WHERE id = $1',
                    [participantId]
                );

                console.log(`➕ Добавлен: ${userCheck.rows[0].username}`);
            }

            await client.query('COMMIT');

            // Логируем событие
            await logTournamentEvent(parseInt(tournamentId), userId, 'team_roster_updated', {
                teamId: parseInt(teamId),
                removed: toRemove.length,
                added: toAdd.length
            });

            res.json({ 
                success: true,
                message: 'Состав команды обновлен',
                changes: {
                    added: toAdd.length,
                    removed: toRemove.length
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('❌ Ошибка обновления состава:', error);
            throw error;
        } finally {
            client.release();
        }
    });
}

module.exports = TeamMemberController;
