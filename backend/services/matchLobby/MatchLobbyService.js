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
    
    // 🔎 Батч: активные лобби по списку матчей для пользователя
    static async getActiveLobbiesByMatchesBatch(tournamentId, matchIds, userId) {
        // Убираем дубликаты и ограничиваем размер
        const ids = Array.from(new Set(matchIds.map((v) => parseInt(v)).filter((v) => Number.isInteger(v) && v > 0)));
        if (ids.length === 0) return {};

        const result = await pool.query(
            `SELECT DISTINCT ON (l.match_id)
                    l.id, l.match_id
             FROM match_lobbies l
             JOIN lobby_invitations i ON i.lobby_id = l.id AND i.user_id = $3
             WHERE l.tournament_id = $1
               AND l.match_id = ANY($2::int[])
               AND l.status IN ('waiting','ready','picking')
             ORDER BY l.match_id, l.created_at DESC NULLS LAST`,
            [parseInt(tournamentId), ids, parseInt(userId)]
        );

        const byMatchId = {};
        for (const row of result.rows) {
            byMatchId[row.match_id] = row.id;
        }

        // Для матчей без активного лобби — явно null
        for (const id of ids) {
            if (!(id in byMatchId)) byMatchId[id] = null;
        }

        return byMatchId;
    }

    // 🔎 Получить активное лобби по матчу, доступное пользователю (по приглашению)
    static async getActiveLobbyByMatch(matchId, tournamentId, userId) {
        const result = await pool.query(
            `SELECT l.*
             FROM match_lobbies l
             JOIN lobby_invitations i ON i.lobby_id = l.id AND i.user_id = $3
             WHERE l.match_id = $1 AND l.tournament_id = $2
               AND l.status IN ('waiting','ready','picking')
             ORDER BY l.created_at DESC NULLS LAST
             LIMIT 1`,
            [matchId, tournamentId, userId]
        );
        return result.rows[0] || null;
    }

    // 🔎 Найти любое лобби по матчу (независимо от статуса)
    static async findLobbyByMatch(matchId, tournamentId) {
        const result = await pool.query(
            `SELECT * FROM match_lobbies 
             WHERE match_id = $1 AND tournament_id = $2 
             ORDER BY created_at DESC NULLS LAST
             LIMIT 1`,
            [matchId, tournamentId]
        );
        return result.rows[0] || null;
    }

    // 🔄 Полное пересоздание лобби: удаляет старое лобби и связанные данные, затем создаёт новое
    static async recreateLobby(matchId, tournamentId, matchFormat) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const existing = await client.query(
                `SELECT id FROM match_lobbies WHERE match_id = $1 AND tournament_id = $2 ORDER BY created_at DESC NULLS LAST LIMIT 1`,
                [matchId, tournamentId]
            );
            if (existing.rows[0]) {
                const lobbyId = existing.rows[0].id;
                await client.query('DELETE FROM map_selections WHERE lobby_id = $1', [lobbyId]);
                await client.query('DELETE FROM lobby_invitations WHERE lobby_id = $1', [lobbyId]);
                await client.query('DELETE FROM match_lobbies WHERE id = $1', [lobbyId]);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        // Создаём новое лобби обычным путём
        return this.createMatchLobby(matchId, tournamentId, matchFormat);
    }
    // 🔎 Список активных лобби для пользователя (по приглашениям)
    static async getActiveLobbiesForUser(userId) {
        const result = await pool.query(
            `SELECT l.*
             FROM match_lobbies l
             JOIN lobby_invitations i ON i.lobby_id = l.id AND i.user_id = $1
             WHERE l.status IN ('waiting','ready','picking')
             ORDER BY l.updated_at DESC NULLS LAST, l.created_at DESC NULLS LAST
             LIMIT 5`,
            [userId]
        );
        return result.rows;
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
    static async createMatchLobby(matchId, tournamentId, matchFormat) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 🛡️ Если лобби для этого матча уже существует и активно, возвращаем его
            const existingLobbyRes = await client.query(
                `SELECT * FROM match_lobbies 
                 WHERE match_id = $1 AND tournament_id = $2 
                 ORDER BY created_at DESC NULLS LAST
                 LIMIT 1`,
                [matchId, tournamentId]
            );
            if (existingLobbyRes.rows[0]) {
                const existingLobby = existingLobbyRes.rows[0];
                // Подготовим минимально необходимые данные для совместимости ответа
                const matchResult = await client.query(
                    `SELECT m.*, 
                            t1.name as team1_name, t2.name as team2_name,
                            t1.id as team1_id, t2.id as team2_id
                     FROM matches m
                     LEFT JOIN tournament_teams t1 ON m.team1_id = t1.id
                     LEFT JOIN tournament_teams t2 ON m.team2_id = t2.id
                     WHERE m.id = $1`,
                    [matchId]
                );
                await client.query('COMMIT');
                return { lobby: existingLobby, match: matchResult.rows[0] || null, invitations: [] };
            }
            
            // Проверяем настройки лобби турнира
            const settingsResult = await client.query(
                'SELECT * FROM tournament_lobby_settings WHERE tournament_id = $1',
                [tournamentId]
            );
            
            if (!settingsResult.rows[0]?.enabled) {
                throw new Error('Лобби не включено для этого турнира');
            }
            
            const settings = settingsResult.rows[0];
            const allowedFormats = new Set(['bo1','bo3','bo5']);
            const chosenFormat = allowedFormats.has(matchFormat) ? matchFormat : (settings.match_format || 'bo1');
            
            // Создаем лобби
            const lobbyResult = await client.query(
                `INSERT INTO match_lobbies (match_id, tournament_id, match_format, status)
                 VALUES ($1, $2, $3, 'waiting')
                 RETURNING *`,
                [matchId, tournamentId, chosenFormat]
            );
            
            const lobby = lobbyResult.rows[0];
            
            // Получаем информацию о матче и участниках
            const matchResult = await client.query(
                `SELECT m.*, 
                        t1.name as team1_name, t2.name as team2_name,
                        t1.id as team1_id, t2.id as team2_id
                 FROM matches m
                 LEFT JOIN tournament_teams t1 ON m.team1_id = t1.id
                 LEFT JOIN tournament_teams t2 ON m.team2_id = t2.id
                 WHERE m.id = $1`,
                [matchId]
            );
            
            if (!matchResult.rows[0]) {
                throw new Error('Матч не найден');
            }
            
            const match = matchResult.rows[0];
            
            // Создаем приглашения для всех участников обеих команд, чтобы они могли наблюдать за пиками/банами.
            // Право действий (ready/pick/ban) оставляем только капитанам — проверяется в соответствующих методах.
            const invitations = [];
            if (match.team1_id && match.team2_id) {
                const teamIds = [match.team1_id, match.team2_id];
                const membersResult = await client.query(
                    `SELECT tm.user_id, tm.team_id
                     FROM tournament_team_members tm
                     WHERE tm.team_id = ANY($1::int[])
                       AND tm.user_id IS NOT NULL`,
                    [teamIds]
                );
                const invitedUserIds = new Set();
                for (const member of membersResult.rows) {
                    if (!member.user_id) continue; // фильтр безопасности
                    if (invitedUserIds.has(member.user_id)) continue;
                    const invRes = await client.query(
                        `INSERT INTO lobby_invitations (lobby_id, user_id, team_id)
                         VALUES ($1, $2, $3) RETURNING *`,
                        [lobby.id, member.user_id, member.team_id]
                    );
                    invitations.push(invRes.rows[0]);
                    invitedUserIds.add(member.user_id);
                    await sendNotification(member.user_id, {
                        id: Date.now(),
                        user_id: member.user_id,
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
                    (
                        SELECT i.team_id FROM lobby_invitations i
                        WHERE i.lobby_id = l.id AND i.user_id = $2
                        LIMIT 1
                    ) as user_team_id,
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
             JOIN matches m ON l.match_id = m.id
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
            
            // Проверяем, является ли пользователь приглашенным и капитаном своей команды
            const inviteResult = await client.query(
                `SELECT 
                    i.team_id,
                    EXISTS (
                        SELECT 1 FROM tournament_team_members tm
                        WHERE tm.user_id = i.user_id AND tm.team_id = i.team_id AND tm.is_captain = true
                    ) AS is_captain
                 FROM lobby_invitations i
                 WHERE i.lobby_id = $1 AND i.user_id = $2
                 LIMIT 1`,
                [lobbyId, userId]
            );
            
            if (!inviteResult.rows[0]) {
                throw new Error('Вы не приглашены в это лобби');
            }
            if (!inviteResult.rows[0].is_captain) {
                throw new Error('Только капитан команды может менять статус готовности');
            }
            
            const teamId = inviteResult.rows[0].team_id;
            
            // Получаем информацию о матче
            const matchResult = await client.query(
                `SELECT m.team1_id, m.team2_id
                 FROM match_lobbies l
                 JOIN matches m ON l.match_id = m.id
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

            // Если обе команды готовы, сразу запускаем стадию пиков/банов с случайным первым ходом — без ожидания администратора
            if (lobby.team1_ready && lobby.team2_ready && lobby.status === 'waiting') {
                const teamsRes = await client.query(
                    `SELECT m.team1_id, m.team2_id
                     FROM match_lobbies l
                     JOIN matches m ON l.match_id = m.id
                     WHERE l.id = $1`,
                    [lobbyId]
                );
                const { team1_id, team2_id } = teamsRes.rows[0];
                const firstPicker = Math.random() < 0.5 ? team1_id : team2_id;
                await client.query(
                    `UPDATE match_lobbies 
                     SET status = 'picking', first_picker_team_id = $1, current_turn_team_id = $1
                     WHERE id = $2`,
                    [firstPicker, lobbyId]
                );
            }
            
            await client.query('COMMIT');

            // Live-обновление состояния лобби после изменения готовности/старта пиков
            try {
                const app = global.app;
                const io = app?.get('io');
                if (io) {
                    await this.broadcastLobbyUpdate(io, lobbyId);
                }
            } catch (_) {}

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
            
            // Проверяем, что действует капитан команды-ходящего
            const isCaptainRes = await client.query(
                `SELECT 1
                 FROM tournament_team_members tm
                 WHERE tm.user_id = $1 AND tm.team_id = $2 AND tm.is_captain = true
                 LIMIT 1`,
                [userId, lobby.user_team_id]
            );
            if (isCaptainRes.rows.length === 0) {
                throw new Error('Только капитан команды может выполнять пик/бан');
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
                
                // 🖥️ Генерируем JSON и загружаем на свободный сервер
                try {
                    await this.generateAndLoadMatchConfig(client, lobbyId, userId);
                } catch (configError) {
                    console.error('⚠️ Ошибка генерации/загрузки конфига, но матч создан:', configError);
                }
            } else {
                await client.query(
                    'UPDATE match_lobbies SET current_turn_team_id = $1 WHERE id = $2',
                    [nextTurn.teamId, lobbyId]
                );
            }
            
            await client.query('COMMIT');
            
            const response = {
                success: true,
                completed: nextTurn.completed,
                nextTurn: nextTurn.teamId
            };

            // Live-обновление через WS для всех участников лобби
            try {
                const app = global.app;
                const io = app?.get('io');
                if (io) {
                    await this.broadcastLobbyUpdate(io, lobbyId);
                }
            } catch (_) {}

            return response;
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
             JOIN matches m ON l.match_id = m.id
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

        if (!sequence || currentAction >= sequence.length) {
            return { completed: true };
        }

        // Чёткая очередность ходов: 1,2,1,2, ... (first_picker ходит на чётных шагах с нуля)
        const isFirstPickerTurn = currentAction % 2 === 0;
        const nextTeamId = isFirstPickerTurn ? first_picker_team_id : secondPickerTeamId;
        
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
            `UPDATE matches 
             SET maps_data = $1
             WHERE id = (SELECT match_id FROM match_lobbies WHERE id = $2)
             RETURNING *`,
            [JSON.stringify(selectedMaps.map(map => ({ map_name: map }))), lobbyId]
        );
        
        return matchResult.rows[0];
    }
    
    // 🖥️ Генерация JSON конфига и загрузка на сервер
    static async generateAndLoadMatchConfig(client, lobbyId, userId) {
        const path = require('path');
        const fs = require('fs');
        
        // Получаем данные лобби и матча
        const lobbyResult = await client.query(
            `SELECT ml.*, m.id as match_id, m.team1_name, m.team2_name, m.match_format
             FROM match_lobbies ml
             LEFT JOIN matches m ON m.id = ml.match_id
             WHERE ml.id = $1`,
            [lobbyId]
        );
        
        if (!lobbyResult.rows[0]) {
            throw new Error('Лобби не найдено');
        }
        
        const lobby = lobbyResult.rows[0];
        const matchId = lobby.match_id;
        
        if (!matchId) {
            throw new Error('Матч не найден');
        }
        
        // Получаем выбранные карты
        const mapsResult = await client.query(
            `SELECT map_name 
             FROM map_selections 
             WHERE lobby_id = $1 AND action_type = 'pick'
             ORDER BY action_order`,
            [lobbyId]
        );
        
        const maplist = mapsResult.rows.map(r => String(r.map_name));
        
        // Получаем участников матча (команды и игроки)
        const participantsResult = await client.query(
            `SELECT mlp.team_number, u.steam_id, u.username
             FROM match_lobby_participants mlp
             JOIN users u ON u.id = mlp.user_id
             WHERE mlp.lobby_id = $1
             ORDER BY mlp.team_number`,
            [lobbyId]
        );
        
        // Формируем объект players для MatchZy (steam_id: nickname)
        const team1PlayersObj = {};
        const team2PlayersObj = {};
        
        participantsResult.rows.forEach(p => {
            if (p.steam_id) {
                const steamId = String(p.steam_id);
                const nickname = p.username || 'Player';
                if (p.team_number === 1) {
                    team1PlayersObj[steamId] = nickname;
                } else if (p.team_number === 2) {
                    team2PlayersObj[steamId] = nickname;
                }
            }
        });
        
        // Формируем конфиг
        const matchFormat = lobby.match_format || 'bo1';
        const numMapsByFormat = { bo1: 1, bo3: 3, bo5: 5 };
        const num_maps = numMapsByFormat[matchFormat] || maplist.length;
        
        // Динамически определяем players_per_team (берем максимум из обеих команд)
        const team1Count = Object.keys(team1PlayersObj).length;
        const team2Count = Object.keys(team2PlayersObj).length;
        const players_per_team = Math.max(team1Count, team2Count, 1);
        
        // MatchZy требует matchid как ЧИСЛО (integer)!
        const ts = Date.now().toString().slice(-8); // Последние 8 цифр timestamp
        const matchid = parseInt(`${matchId}${ts}`); // ЧИСЛО, не строка!
        const fileName = `${matchFormat}-match${matchId}-${Date.now()}.json`;
        
        const cfg = {
            matchid, // ЧИСЛО для MatchZy
            num_maps,
            maplist,
            skip_veto: true,
            side_type: 'standard',
            players_per_team, // динамическое значение
            team1: { 
                name: lobby.team1_name || 'Team 1', 
                players: team1PlayersObj // объект {steam_id: nickname}
            },
            team2: { 
                name: lobby.team2_name || 'Team 2', 
                players: team2PlayersObj // объект {steam_id: nickname}
            }
        };
        
        // Сохраняем JSON
        const baseDir = path.join(__dirname, '..', '..', 'lobbies', String(lobbyId));
        fs.mkdirSync(baseDir, { recursive: true });
        const filePath = path.join(baseDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf8');
        
        const publicUrl = `/lobby/${lobbyId}/${fileName}`;
        const fullConfigUrl = `https://1337community.com${publicUrl}`;
        
        console.log(`✅ [Tournament] JSON конфиг сохранен: ${fullConfigUrl} (matchid=${matchid})`);
        
        // Ищем свободный сервер и загружаем конфиг
        const rconService = require('../rconService');
        const serversResult = await client.query(
            'SELECT * FROM cs2_servers WHERE is_active = true ORDER BY id ASC'
        );
        
        console.log(`🔍 [Tournament] Поиск свободного сервера среди ${serversResult.rows.length} активных...`);
        
        let selectedServer = null;
        
        for (const server of serversResult.rows) {
            try {
                console.log(`⏳ [Tournament] Проверка сервера ${server.name} (${server.host}:${server.port})...`);
                
                const result = await rconService.executeCommand(
                    server.id,
                    `matchzy_loadmatch_url "${fullConfigUrl}"`,
                    {
                        userId: userId,
                        lobbyId: lobbyId,
                        logToDb: true
                    }
                );
                
                const response = result.response || '';
                
                if (response.includes('A match is already setup') || 
                    response.includes('already setup') ||
                    response.includes('match already in progress')) {
                    console.log(`⚠️ [Tournament] Сервер ${server.name} занят, пробуем следующий...`);
                    continue;
                }
                
                selectedServer = server;
                
                // Формируем ссылки подключения
                const serverPass = server.server_password || '';
                const connect = `steam://connect/${server.host}:${server.port}${serverPass ? '/' + serverPass : ''}`;
                
                const gotvHost = server.gotv_host || server.host;
                const gotvPort = server.gotv_port || server.port;
                const gotvPass = server.gotv_password || '';
                const gotv = `steam://connect/${gotvHost}:${gotvPort}${gotvPass ? '/' + gotvPass : ''}`;
                
                console.log(`✅ [Tournament] Конфиг загружен на сервер ${server.name}!`);
                console.log(`📡 [Tournament] Connect: ${connect}`);
                
                // Обновляем матч с данными сервера
                await client.query(
                    `UPDATE matches 
                     SET connect_url = $1, gotv_url = $2, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $3`,
                    [connect, gotv, matchId]
                );
                
                // Обновляем статус сервера
                await client.query(
                    'UPDATE cs2_servers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    ['in_use', server.id]
                );
                
                break;
                
            } catch (serverError) {
                console.error(`❌ [Tournament] Ошибка на сервере ${server.name}:`, serverError.message);
                continue;
            }
        }
        
        if (!selectedServer) {
            console.warn('⚠️ [Tournament] Не найдено свободных серверов!');
        }
        
        return selectedServer;
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