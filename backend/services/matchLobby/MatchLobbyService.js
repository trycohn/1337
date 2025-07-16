// 🎮 MatchLobbyService - Сервис управления лобби матчей для CS2
const pool = require('../../db');
const { sendNotification } = require('../../notifications');

class MatchLobbyService {
    // 🔧 Создание настроек лобби для турнира
    static async createLobbySettings(tournamentId, settings) {
        const { enabled = false, matchFormat = null } = settings;
        
        const result = await pool.query(
            `INSERT INTO tournament_lobby_settings (tournament_id, enabled, match_format)
             VALUES ($1, $2, $3)
             ON CONFLICT (tournament_id)
             DO UPDATE SET enabled = $2, match_format = $3, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [tournamentId, enabled, matchFormat]
        );
        
        // Обновляем флаг в основной таблице турниров
        await pool.query(
            'UPDATE tournaments SET lobby_enabled = $1 WHERE id = $2',
            [enabled, tournamentId]
        );
        
        return result.rows[0];
    }
    
    // 🗺️ Управление картами турнира
    static async setTournamentMaps(tournamentId, maps) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Удаляем старые карты
            await client.query(
                'DELETE FROM tournament_maps WHERE tournament_id = $1',
                [tournamentId]
            );
            
            // Добавляем новые карты
            const mapPromises = maps.map((mapName, index) => 
                client.query(
                    `INSERT INTO tournament_maps (tournament_id, map_name, display_order)
                     VALUES ($1, $2, $3) RETURNING *`,
                    [tournamentId, mapName, index]
                )
            );
            
            const results = await Promise.all(mapPromises);
            await client.query('COMMIT');
            
            return results.map(r => r.rows[0]);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    // 🏁 Создание лобби для матча
    static async createMatchLobby(matchId, tournamentId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Проверяем настройки лобби турнира
            const settingsResult = await client.query(
                'SELECT * FROM tournament_lobby_settings WHERE tournament_id = $1',
                [tournamentId]
            );
            
            if (!settingsResult.rows[0]?.enabled) {
                throw new Error('Лобби не включено для этого турнира');
            }
            
            const settings = settingsResult.rows[0];
            
            // Создаем лобби
            const lobbyResult = await client.query(
                `INSERT INTO match_lobbies (match_id, tournament_id, match_format, status)
                 VALUES ($1, $2, $3, 'waiting')
                 RETURNING *`,
                [matchId, tournamentId, settings.match_format]
            );
            
            const lobby = lobbyResult.rows[0];
            
            // Получаем информацию о матче и участниках
            const matchResult = await client.query(
                `SELECT m.*, 
                        t1.name as team1_name, t2.name as team2_name,
                        t1.id as team1_id, t2.id as team2_id
                 FROM tournament_matches m
                 LEFT JOIN tournament_teams t1 ON m.team1_id = t1.id
                 LEFT JOIN tournament_teams t2 ON m.team2_id = t2.id
                 WHERE m.id = $1`,
                [matchId]
            );
            
            if (!matchResult.rows[0]) {
                throw new Error('Матч не найден');
            }
            
            const match = matchResult.rows[0];
            
            // Создаем приглашения для капитанов команд или соло участников
            const invitations = [];
            
            // Для командного турнира - приглашаем капитанов
            if (match.team1_id && match.team2_id) {
                // Получаем капитанов команд
                const captainsResult = await client.query(
                    `SELECT tm.user_id, tm.team_id, u.username
                     FROM tournament_team_members tm
                     JOIN users u ON tm.user_id = u.id
                     WHERE tm.team_id IN ($1, $2) AND tm.is_captain = true`,
                    [match.team1_id, match.team2_id]
                );
                
                for (const captain of captainsResult.rows) {
                    const invResult = await client.query(
                        `INSERT INTO lobby_invitations (lobby_id, user_id, team_id)
                         VALUES ($1, $2, $3) RETURNING *`,
                        [lobby.id, captain.user_id, captain.team_id]
                    );
                    invitations.push(invResult.rows[0]);
                    
                    // Отправляем уведомление
                    await sendNotification(captain.user_id, {
                        id: Date.now(),
                        user_id: captain.user_id,
                        type: 'match_lobby_invite',
                        message: `Вы приглашены в лобби матча турнира. Нажмите для входа.`,
                        metadata: JSON.stringify({ lobbyId: lobby.id, matchId, tournamentId }),
                        created_at: new Date()
                    });
                }
            }
            
            await client.query('COMMIT');
            
            return {
                lobby,
                match,
                invitations
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    // 🎯 Получение информации о лобби
    static async getLobbyInfo(lobbyId, userId) {
        const result = await pool.query(
            `SELECT l.*, 
                    m.team1_id, m.team2_id,
                    t1.name as team1_name, t2.name as team2_name,
                    t.name as tournament_name, t.game,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM lobby_invitations 
                            WHERE lobby_id = l.id AND user_id = $2
                        ) THEN true 
                        ELSE false 
                    END as user_invited,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'map_name', ms.map_name,
                                'action_type', ms.action_type,
                                'team_id', ms.team_id,
                                'action_order', ms.action_order
                            ) ORDER BY ms.action_order
                        )
                        FROM map_selections ms
                        WHERE ms.lobby_id = l.id
                    ) as selections,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'map_name', tm.map_name,
                                'display_order', tm.display_order
                            ) ORDER BY tm.display_order
                        )
                        FROM tournament_maps tm
                        WHERE tm.tournament_id = l.tournament_id
                    ) as available_maps
             FROM match_lobbies l
             JOIN tournament_matches m ON l.match_id = m.id
             JOIN tournaments t ON l.tournament_id = t.id
             LEFT JOIN tournament_teams t1 ON m.team1_id = t1.id
             LEFT JOIN tournament_teams t2 ON m.team2_id = t2.id
             WHERE l.id = $1`,
            [lobbyId, userId]
        );
        
        if (!result.rows[0]) {
            throw new Error('Лобби не найдено');
        }
        
        return result.rows[0];
    }
    
    // ✅ Установка готовности участника
    static async setReadyStatus(lobbyId, userId, ready) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Проверяем, является ли пользователь участником
            const inviteResult = await client.query(
                `SELECT i.*, tm.team_id
                 FROM lobby_invitations i
                 LEFT JOIN tournament_team_members tm ON i.user_id = tm.user_id
                 WHERE i.lobby_id = $1 AND i.user_id = $2`,
                [lobbyId, userId]
            );
            
            if (!inviteResult.rows[0]) {
                throw new Error('Вы не приглашены в это лобби');
            }
            
            const teamId = inviteResult.rows[0].team_id;
            
            // Получаем информацию о матче
            const matchResult = await client.query(
                `SELECT m.team1_id, m.team2_id
                 FROM match_lobbies l
                 JOIN tournament_matches m ON l.match_id = m.id
                 WHERE l.id = $1`,
                [lobbyId]
            );
            
            const match = matchResult.rows[0];
            const isTeam1 = match.team1_id === teamId;
            
            // Обновляем статус готовности
            const updateField = isTeam1 ? 'team1_ready' : 'team2_ready';
            const result = await client.query(
                `UPDATE match_lobbies 
                 SET ${updateField} = $1
                 WHERE id = $2
                 RETURNING *`,
                [ready, lobbyId]
            );
            
            const lobby = result.rows[0];
            
            // Если обе команды готовы, начинаем процесс выбора карт
            if (lobby.team1_ready && lobby.team2_ready && lobby.status === 'waiting') {
                await client.query(
                    `UPDATE match_lobbies 
                     SET status = 'ready'
                     WHERE id = $1`,
                    [lobbyId]
                );
            }
            
            await client.query('COMMIT');
            
            return lobby;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    // 🎲 Назначение первого выбирающего
    static async setFirstPicker(lobbyId, teamId, adminUserId) {
        const result = await pool.query(
            `UPDATE match_lobbies 
             SET first_picker_team_id = $1, 
                 current_turn_team_id = $1,
                 status = 'picking'
             WHERE id = $2 AND status = 'ready'
             RETURNING *`,
            [teamId, lobbyId]
        );
        
        if (!result.rows[0]) {
            throw new Error('Не удалось назначить первого выбирающего');
        }
        
        return result.rows[0];
    }
    
    // 🗺️ Выбор или бан карты
    static async selectMap(lobbyId, userId, mapName, action) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Проверяем права пользователя и текущий ход
            const lobbyResult = await client.query(
                `SELECT l.*, i.team_id as user_team_id
                 FROM match_lobbies l
                 JOIN lobby_invitations i ON l.id = i.lobby_id
                 WHERE l.id = $1 AND i.user_id = $2`,
                [lobbyId, userId]
            );
            
            if (!lobbyResult.rows[0]) {
                throw new Error('Лобби не найдено или вы не участник');
            }
            
            const lobby = lobbyResult.rows[0];
            
            if (lobby.status !== 'picking') {
                throw new Error('Выбор карт еще не начался');
            }
            
            if (lobby.current_turn_team_id !== lobby.user_team_id) {
                throw new Error('Сейчас не ваш ход');
            }
            
            // Проверяем, не была ли карта уже выбрана/забанена
            const existingSelection = await client.query(
                'SELECT * FROM map_selections WHERE lobby_id = $1 AND map_name = $2',
                [lobbyId, mapName]
            );
            
            if (existingSelection.rows[0]) {
                throw new Error('Эта карта уже была выбрана или забанена');
            }
            
            // Получаем текущее количество действий
            const actionsCount = await client.query(
                'SELECT COUNT(*) as count FROM map_selections WHERE lobby_id = $1',
                [lobbyId]
            );
            
            const actionOrder = parseInt(actionsCount.rows[0].count) + 1;
            
            // Сохраняем выбор
            await client.query(
                `INSERT INTO map_selections (lobby_id, map_name, action_type, team_id, action_order)
                 VALUES ($1, $2, $3, $4, $5)`,
                [lobbyId, mapName, action, lobby.user_team_id, actionOrder]
            );
            
            // Определяем следующий ход
            const nextTurn = await this.determineNextTurn(
                client, 
                lobbyId, 
                lobby.match_format, 
                actionOrder
            );
            
            if (nextTurn.completed) {
                await client.query(
                    `UPDATE match_lobbies 
                     SET status = 'completed', 
                         completed_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [lobbyId]
                );
                
                // Сохраняем выбранные карты в матч
                await this.saveSelectedMapsToMatch(client, lobbyId);
            } else {
                await client.query(
                    'UPDATE match_lobbies SET current_turn_team_id = $1 WHERE id = $2',
                    [nextTurn.teamId, lobbyId]
                );
            }
            
            await client.query('COMMIT');
            
            return {
                success: true,
                completed: nextTurn.completed,
                nextTurn: nextTurn.teamId
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    // 🔄 Определение следующего хода
    static async determineNextTurn(client, lobbyId, matchFormat, currentAction) {
        // Получаем информацию о командах
        const teamsResult = await client.query(
            `SELECT m.team1_id, m.team2_id, l.first_picker_team_id
             FROM match_lobbies l
             JOIN tournament_matches m ON l.match_id = m.id
             WHERE l.id = $1`,
            [lobbyId]
        );
        
        const { team1_id, team2_id, first_picker_team_id } = teamsResult.rows[0];
        const secondPickerTeamId = team1_id === first_picker_team_id ? team2_id : team1_id;
        
        // Последовательности действий для разных форматов
        const sequences = {
            'bo1': ['ban', 'ban', 'ban', 'ban', 'ban', 'ban', 'pick'],
            'bo3': ['ban', 'ban', 'pick', 'pick', 'ban', 'ban', 'pick'],
            'bo5': ['pick', 'pick', 'ban', 'ban', 'pick', 'pick', 'pick']
        };
        
        const sequence = sequences[matchFormat];
        
        if (currentAction >= sequence.length) {
            return { completed: true };
        }
        
        // Определяем, чей следующий ход
        // В bo1: чередуются
        // В bo3: 1-2-2-1-1-2-2
        // В bo5: 1-2-2-1-1-2-2
        const turnPatterns = {
            'bo1': [1, 2, 1, 2, 1, 2, 1],
            'bo3': [1, 2, 2, 1, 1, 2, 2],
            'bo5': [1, 2, 2, 1, 1, 2, 2]
        };
        
        const pattern = turnPatterns[matchFormat];
        const nextTurnIndex = pattern[currentAction];
        const nextTeamId = nextTurnIndex === 1 ? first_picker_team_id : secondPickerTeamId;
        
        return { 
            completed: false, 
            teamId: nextTeamId,
            actionType: sequence[currentAction]
        };
    }
    
    // 💾 Сохранение выбранных карт в матч
    static async saveSelectedMapsToMatch(client, lobbyId) {
        // Получаем все pick карты
        const picksResult = await client.query(
            `SELECT map_name 
             FROM map_selections 
             WHERE lobby_id = $1 AND action_type = 'pick'
             ORDER BY action_order`,
            [lobbyId]
        );
        
        const selectedMaps = picksResult.rows.map(r => r.map_name);
        
        // Обновляем матч
        const matchResult = await client.query(
            `UPDATE tournament_matches 
             SET maps_data = $1
             WHERE id = (SELECT match_id FROM match_lobbies WHERE id = $2)
             RETURNING *`,
            [JSON.stringify(selectedMaps.map(map => ({ map_name: map }))), lobbyId]
        );
        
        return matchResult.rows[0];
    }
    
    // 📡 Подписка на обновления лобби (для WebSocket)
    static async subscribeToLobby(io, socket, lobbyId, userId) {
        // Проверяем права доступа
        const lobby = await this.getLobbyInfo(lobbyId, userId);
        
        if (!lobby.user_invited) {
            throw new Error('У вас нет доступа к этому лобби');
        }
        
        // Присоединяем к комнате
        socket.join(`lobby_${lobbyId}`);
        
        // Отправляем текущее состояние
        socket.emit('lobby_state', lobby);
        
        console.log(`✅ Пользователь ${userId} подключился к лобби ${lobbyId}`);
    }
    
    // 📤 Отправка обновлений всем участникам лобби
    static async broadcastLobbyUpdate(io, lobbyId) {
        const lobby = await pool.query(
            `SELECT l.*, 
                    (
                        SELECT json_agg(
                            json_build_object(
                                'map_name', ms.map_name,
                                'action_type', ms.action_type,
                                'team_id', ms.team_id,
                                'action_order', ms.action_order
                            ) ORDER BY ms.action_order
                        )
                        FROM map_selections ms
                        WHERE ms.lobby_id = l.id
                    ) as selections
             FROM match_lobbies l
             WHERE l.id = $1`,
            [lobbyId]
        );
        
        if (lobby.rows[0]) {
            io.to(`lobby_${lobbyId}`).emit('lobby_update', lobby.rows[0]);
        }
    }
}

module.exports = MatchLobbyService; 