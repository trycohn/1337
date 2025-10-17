// 🎮 MatchLobbyController - Контроллер управления лобби матчей
const MatchLobbyService = require('../../services/matchLobby/MatchLobbyService');
const { sendSystemNotification, ensureSystemUser } = require('../../utils/systemNotifications');
const { sendTournamentChatAnnouncement } = require('../../utils/tournament/chatHelpers');
const pool = require('../../db');

class MatchLobbyController {
    // 🔧 Создание/обновление настроек лобби для турнира
    static async updateLobbySettings(req, res) {
        try {
            const { id } = req.params;
            const { enabled, matchFormat, maps } = req.body;
            const userId = req.user.id;
            
            // Проверяем права доступа
            const isAdmin = await req.checkTournamentAccess(id, userId);
            if (!isAdmin) {
                return res.status(403).json({ 
                    error: 'У вас нет прав для управления настройками лобби' 
                });
            }
            
            // Валидация карт (должно быть ровно 7)
            if (enabled && maps && maps.length !== 7) {
                return res.status(400).json({ 
                    error: 'Для включения лобби необходимо выбрать ровно 7 карт' 
                });
            }
            
            // Обновляем настройки
            const settings = await MatchLobbyService.createLobbySettings(id, {
                enabled,
                matchFormat
            });
            
            // Если переданы карты, сохраняем их
            if (maps && maps.length === 7) {
                await MatchLobbyService.setTournamentMaps(id, maps);
            }
            
            res.json({
                success: true,
                settings,
                message: 'Настройки лобби успешно обновлены'
            });
            
        } catch (error) {
            console.error('❌ Ошибка обновления настроек лобби:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при обновлении настроек лобби' 
            });
        }
    }
    
    // 🔎 Получение активного лобби по матчу
    static async getActiveLobbyByMatch(req, res) {
        try {
            const { tournamentId, matchId } = req.params;
            const userId = req.user.id;

            const lobby = await MatchLobbyService.getActiveLobbyByMatch(matchId, tournamentId, userId);
            if (!lobby) {
                return res.json({ success: true, lobby: null });
            }
            return res.json({ success: true, lobby });
        } catch (error) {
            console.error('❌ Ошибка получения активного лобби по матчу:', error);
            res.status(500).json({ error: error.message || 'Ошибка при получении активного лобби' });
        }
    }

    // 🔎 Батч: активные лобби по списку матчей
    static async getActiveLobbiesBatch(req, res) {
        try {
            const { tournamentId } = req.params;
            const userId = req.user.id;
            const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];

            if (!ids || ids.length === 0) {
                return res.json({ success: true, byMatchId: {} });
            }

            // Ограничение размера батча для защиты
            const MAX_IDS = 300;
            const matchIds = ids
                .map((v) => parseInt(v))
                .filter((v) => Number.isInteger(v) && v > 0)
                .slice(0, MAX_IDS);

            if (matchIds.length === 0) {
                return res.json({ success: true, byMatchId: {} });
            }

            const start = Date.now();
            const byMatchId = await MatchLobbyService.getActiveLobbiesByMatchesBatch(
                tournamentId,
                matchIds,
                userId
            );

            // Короткие приватные заголовки кэша
            res.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
            res.set('Vary', 'Authorization');

            const duration = Date.now() - start;
            try {
                res.set('X-Batch-Size', String(matchIds.length));
                res.set('X-Response-Time', `${duration}ms`);
            } catch (_) {}
            console.log(`[active-lobbies batch] user=${userId} t=${tournamentId} size=${matchIds.length} duration=${duration}ms`);

            return res.json({ success: true, byMatchId });
        } catch (error) {
            console.error('❌ Ошибка батч-получения активных лобби:', error);
            res.status(500).json({ error: error.message || 'Ошибка при получении активных лобби' });
        }
    }

    // 🔎 Получение активных лобби для текущего пользователя
    static async getActiveLobbiesForUser(req, res) {
        try {
            const userId = req.user.id;
            const start = Date.now();
            const lobbies = await MatchLobbyService.getActiveLobbiesForUser(userId);
            // Приватный короткий кэш и метрики ответа
            res.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
            res.set('Vary', 'Authorization');
            try { res.set('X-Response-Time', `${Date.now() - start}ms`); } catch (_) {}
            res.json({ success: true, lobbies });
        } catch (error) {
            console.error('❌ Ошибка получения активных лобби пользователя:', error);
            res.status(500).json({ error: error.message || 'Ошибка при получении активных лобби' });
        }
    }

    // 🏁 Создание лобби для матча
    static async createMatchLobby(req, res) {
        try {
            const { tournamentId, matchId } = req.params;
            const { matchFormat } = req.body || {};
            const userId = req.user.id;
            
            // Проверяем права доступа
            const isAdmin = await req.checkTournamentAccess(tournamentId, userId);
            if (!isAdmin) {
                return res.status(403).json({ 
                    error: 'У вас нет прав для создания лобби матча' 
                });
            }
            
            // Если уже есть лобби — возвращаем предупреждение для UI
            const existing = await MatchLobbyService.findLobbyByMatch(matchId, tournamentId);
            if (existing) {
                return res.status(200).json({
                    success: true,
                    alreadyExists: true,
                    lobby: existing,
                    message: 'Лобби этого матча уже было создано ранее'
                });
            }

            const result = await MatchLobbyService.createMatchLobby(matchId, tournamentId, matchFormat);
            
            // Отправляем уведомления через WebSocket
            const io = req.app.get('io');
            if (io) {
                result.invitations.forEach(invitation => {
                    io.to(`user_${invitation.user_id}`).emit('match_lobby_invite', {
                        lobbyId: result.lobby.id,
                        matchId,
                        tournamentId
                    });
                });
            }

            // 📨 Дублируем приглашение в личный чат (без иконок, персонализировано)
            try {
                const baseUrl = process.env.PUBLIC_WEB_URL || 'https://1337community.com';
                const lobbyUrl = `${baseUrl}/match-lobby/${result.lobby.id}`;
                const matchUrl = `${baseUrl}/tournaments/${tournamentId}/match/${matchId}`;
                const tournamentUrl = `${baseUrl}/tournaments/${tournamentId}`;

                // Получаем название турнира
                const tRes = await pool.query('SELECT name FROM tournaments WHERE id = $1', [tournamentId]);
                const tournamentName = tRes.rows[0]?.name || `Турнир #${tournamentId}`;

                const team1Name = result.match?.team1_name || 'Команда 1';
                const team2Name = result.match?.team2_name || 'Команда 2';
                const team1Id = result.match?.team1_id;
                const team2Id = result.match?.team2_id;

                const metadataBase = {
                    type: 'lobby_invite',
                    tournament_id: Number(tournamentId),
                    match_id: Number(matchId),
                    lobby_id: Number(result.lobby.id),
                    actions: [
                        { type: 'open_lobby', label: 'Перейти в лобби', action: 'open_lobby', style: 'primary', url: lobbyUrl, target: '_blank' }
                    ]
                };

                await Promise.all(result.invitations.map(async (inv) => {
                    // Имя пользователя
                    const uRes = await pool.query('SELECT username FROM users WHERE id = $1', [inv.user_id]);
                    const username = uRes.rows[0]?.username || 'участник';
                    // Определяем соперника
                    const opponentName = inv.team_id && team1Id && team2Id
                        ? (Number(inv.team_id) === Number(team1Id) ? team2Name : team1Name)
                        : (team1Name && team2Name ? `${team1Name} / ${team2Name}` : 'соперник');

                    // Форматированное сообщение с Markdown-ссылкой
                    const message = `Привет, ${username}! Турнир [${tournamentName}](${tournamentUrl}), ваш матч против "${opponentName}" ожидает. [Лобби матча](${lobbyUrl}).`;

                    await sendSystemNotification(inv.user_id, message, 'lobby_invite', metadataBase);
                }));
            } catch (e) {
                console.warn('⚠️ Не удалось отправить персональные сообщения о лобби:', e.message);
            }

            // 💬 Анонс в чат турнира от системного пользователя
            try {
                const systemUserId = await ensureSystemUser();
                const baseUrl = process.env.PUBLIC_WEB_URL || 'https://1337community.com';
                const lobbyUrl = `${baseUrl}/match-lobby/${result.lobby.id}`;
                const announcement = `📢 Создано лобби для матча ID ${matchId}. Перейдите: ${lobbyUrl}`;
                await sendTournamentChatAnnouncement(Number(tournamentId), announcement, 'system', systemUserId);
            } catch (e) {
                console.warn('⚠️ Не удалось отправить анонс в чат турнира:', e.message);
            }
            
            res.json({
                success: true,
                lobby: result.lobby,
                invitations: result.invitations,
                message: 'Лобби создано, приглашения отправлены'
            });
            
        } catch (error) {
            console.error('❌ Ошибка создания лобби:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при создании лобби' 
            });
        }
    }

    // 🔄 Пересоздать лобби принудительно
    static async recreateMatchLobby(req, res) {
        try {
            const { tournamentId, matchId } = req.params;
            const { matchFormat } = req.body || {};
            const userId = req.user.id;

            const isAdmin = await req.checkTournamentAccess(tournamentId, userId);
            if (!isAdmin) {
                return res.status(403).json({ 
                    error: 'У вас нет прав для пересоздания лобби матча' 
                });
            }

            const result = await MatchLobbyService.recreateLobby(matchId, tournamentId, matchFormat);

            const io = req.app.get('io');
            if (io) {
                result.invitations.forEach(invitation => {
                    io.to(`user_${invitation.user_id}`).emit('match_lobby_invite', {
                        lobbyId: result.lobby.id,
                        matchId,
                        tournamentId
                    });
                });
            }

            // 📨 Дублируем приглашение в личный чат (пересоздание, без иконок, персонально)
            try {
                const baseUrl = process.env.PUBLIC_WEB_URL || 'https://1337community.com';
                const lobbyUrl = `${baseUrl}/match-lobby/${result.lobby.id}`;
                const tournamentUrl = `${baseUrl}/tournaments/${tournamentId}`;

                const tRes = await pool.query('SELECT name FROM tournaments WHERE id = $1', [tournamentId]);
                const tournamentName = tRes.rows[0]?.name || `Турнир #${tournamentId}`;

                const team1Name = result.match?.team1_name || 'Команда 1';
                const team2Name = result.match?.team2_name || 'Команда 2';
                const team1Id = result.match?.team1_id;
                const team2Id = result.match?.team2_id;

                const metadataBase = {
                    type: 'match_lobby_invite',
                    tournament_id: Number(tournamentId),
                    match_id: Number(matchId),
                    lobby_id: Number(result.lobby.id),
                    actions: [
                        { type: 'open_lobby', label: 'Перейти в лобби', action: 'open_lobby', style: 'primary', url: lobbyUrl, target: '_blank' }
                    ]
                };

                await Promise.all(result.invitations.map(async (inv) => {
                    const uRes = await pool.query('SELECT username FROM users WHERE id = $1', [inv.user_id]);
                    const username = uRes.rows[0]?.username || 'участник';
                    const opponentName = inv.team_id && team1Id && team2Id
                        ? (Number(inv.team_id) === Number(team1Id) ? team2Name : team1Name)
                        : (team1Name && team2Name ? `${team1Name} / ${team2Name}` : 'соперник');

                    const message = `Привет, ${username}! Турнир [${tournamentName}](${tournamentUrl}), ваш матч против "${opponentName}" ожидает. [Лобби матча](${lobbyUrl}).`;

                    await sendSystemNotification(inv.user_id, message, 'match_lobby_invite_interactive', metadataBase);
                }));
            } catch (e) {
                console.warn('⚠️ Не удалось отправить персональные сообщения о пересоздании лобби:', e.message);
            }

            // 💬 Анонс в чат турнира от системного пользователя
            try {
                const systemUserId = await ensureSystemUser();
                const baseUrl = process.env.NODE_ENV === 'production'
                    ? 'https://1337community.com'
                    : 'http://localhost:3000';
                const lobbyUrl = `${baseUrl}/match-lobby/${result.lobby.id}`;
                const announcement = `📢 Лобби для матча ID ${matchId} пересоздано. Перейдите: ${lobbyUrl}`;
                await sendTournamentChatAnnouncement(Number(tournamentId), announcement, 'system', systemUserId);
            } catch (e) {
                console.warn('⚠️ Не удалось отправить анонс в чат турнира (пересоздание):', e.message);
            }

            res.json({
                success: true,
                lobby: result.lobby,
                invitations: result.invitations,
                message: 'Лобби пересоздано, приглашения отправлены'
            });
        } catch (error) {
            console.error('❌ Ошибка пересоздания лобби:', error);
            res.status(500).json({ error: error.message || 'Ошибка при пересоздании лобби' });
        }
    }
    
    // 🎯 Получение информации о лобби
    static async getLobbyInfo(req, res) {
        try {
            const { lobbyId } = req.params;
            const userId = req.user.id;
            
            const lobby = await MatchLobbyService.getLobbyInfo(lobbyId, userId);
            
            // ⏰ Проверяем устаревание лобби
            const isExpired = MatchLobbyService.isLobbyExpired(lobby);
            
            if (isExpired) {
                return res.status(410).json({
                    success: false,
                    expired: true,
                    error: 'Лобби устарело (создано более 1 часа назад)',
                    message: 'Это лобби больше недоступно. Попросите администратора создать новое.'
                });
            }
            
            res.json({
                success: true,
                lobby,
                expired: false
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения информации о лобби:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при получении информации о лобби' 
            });
        }
    }
    
    // ✅ Установка готовности
    static async setReadyStatus(req, res) {
        try {
            const { lobbyId } = req.params;
            const { ready } = req.body;
            const userId = req.user.id;
            
            // Обновляем готовность отдельного игрока
            await MatchLobbyService.setPlayerReady(lobbyId, userId, ready);
            
            // Отправляем обновление всем участникам
            const io = req.app.get('io');
            if (io) {
                io.to(`lobby_${lobbyId}`).emit('lobby_update_player_ready', {
                    userId,
                    ready: Boolean(ready)
                });
                
                await MatchLobbyService.broadcastLobbyUpdate(io, lobbyId);
            }
            
            res.json({
                success: true,
                ready: Boolean(ready),
                message: ready ? 'Вы готовы' : 'Вы не готовы'
            });
            
        } catch (error) {
            console.error('❌ Ошибка установки готовности:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при установке готовности' 
            });
        }
    }
    
    // 🎲 Назначение первого выбирающего
    static async setFirstPicker(req, res) {
        try {
            const { lobbyId } = req.params;
            const { teamId } = req.body;
            const userId = req.user.id;
            
            // Проверяем права администратора
            const lobbyInfo = await MatchLobbyService.getLobbyInfo(lobbyId, userId);

            // 🛡️ Разрешение ролей: если пользователь приглашён в лобби как участник, он действует как капитан (без админ-действий)
            if (lobbyInfo.user_invited) {
                return res.status(403).json({ 
                    error: 'Вы являетесь участником лобби и не можете выполнять админ-действия в лобби' 
                });
            }

            const isAdmin = await req.checkTournamentAccess(lobbyInfo.tournament_id, userId);
            
            if (!isAdmin) {
                return res.status(403).json({ 
                    error: 'У вас нет прав для назначения первого выбирающего' 
                });
            }
            
            const lobby = await MatchLobbyService.setFirstPicker(
                lobbyId, 
                teamId, 
                userId
            );
            
            // Отправляем обновление всем участникам
            const io = req.app.get('io');
            if (io) {
                await MatchLobbyService.broadcastLobbyUpdate(io, lobbyId);
            }
            
            res.json({
                success: true,
                lobby,
                message: 'Первый выбирающий назначен'
            });
            
        } catch (error) {
            console.error('❌ Ошибка назначения первого выбирающего:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при назначении первого выбирающего' 
            });
        }
    }
    
    // 🚀 Ручной запуск процедуры пик/бан (админ турнира или капитаны)
    static async startPickBan(req, res) {
        try {
            const { lobbyId } = req.params;
            const userId = req.user.id;
            
            const lobbyInfo = await MatchLobbyService.getLobbyInfo(lobbyId, userId);
            
            if (!lobbyInfo) {
                return res.status(404).json({ 
                    error: 'Лобби не найдено' 
                });
            }
            
            // Проверяем права: админ турнира или капитан команды
            const isAdmin = await req.checkTournamentAccess(lobbyInfo.tournament_id, userId);
            
            // Проверяем является ли капитаном
            const isCaptain = lobbyInfo.team1_participants?.find(p => p.user_id === userId && p.is_captain) ||
                             lobbyInfo.team2_participants?.find(p => p.user_id === userId && p.is_captain);
            
            if (!isAdmin && !isCaptain) {
                return res.status(403).json({ 
                    error: 'Только админ турнира или капитаны могут запустить процедуру' 
                });
            }
            
            // Проверяем условия для старта
            if (!lobbyInfo.match_format) {
                return res.status(400).json({ 
                    error: 'Формат матча не выбран' 
                });
            }
            
            if (!lobbyInfo.team1_ready || !lobbyInfo.team2_ready) {
                return res.status(400).json({ 
                    error: 'Обе команды должны быть готовы' 
                });
            }
            
            if (lobbyInfo.status !== 'ready' && lobbyInfo.status !== 'waiting') {
                return res.status(400).json({ 
                    error: 'Процедура уже запущена или завершена' 
                });
            }
            
            // Запускаем процедуру
            const lobby = await MatchLobbyService.startPickBanProcedure(lobbyId);
            
            // WebSocket уведомление
            const io = req.app.get('io');
            if (io) {
                await MatchLobbyService.broadcastLobbyUpdate(io, lobbyId);
            }
            
            res.json({
                success: true,
                lobby,
                message: '🚀 Процедура выбора карт запущена!'
            });
            
        } catch (error) {
            console.error('❌ Ошибка запуска процедуры:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при запуске процедуры' 
            });
        }
    }
    
    // 🗺️ Выбор или бан карты
    static async selectMap(req, res) {
        try {
            const { lobbyId } = req.params;
            const { mapName, action } = req.body;
            const userId = req.user.id;
            
            // Валидация действия
            if (!['pick', 'ban'].includes(action)) {
                return res.status(400).json({ 
                    error: 'Недопустимое действие. Используйте "pick" или "ban"' 
                });
            }
            
            const result = await MatchLobbyService.selectMap(
                lobbyId, 
                userId, 
                mapName, 
                action
            );
            
            // Отправляем обновление всем участникам
            const io = req.app.get('io');
            if (io) {
                await MatchLobbyService.broadcastLobbyUpdate(io, lobbyId);
                
                if (result.completed) {
                    // Дополнительно отдаём tournamentId и matchId, чтобы фронтенд мог корректно перейти
                    try {
                        const lobbyInfo = await MatchLobbyService.getLobbyInfo(lobbyId, req.user.id);
                        io.to(`lobby_${lobbyId}`).emit('lobby_completed', {
                            lobbyId,
                            tournamentId: lobbyInfo.tournament_id,
                            matchId: lobbyInfo.match_id,
                            message: 'Выбор карт завершен'
                        });
                    } catch (_) {
                        io.to(`lobby_${lobbyId}`).emit('lobby_completed', {
                            lobbyId,
                            message: 'Выбор карт завершен'
                        });
                    }
                }
            }
            
            res.json({
                success: true,
                completed: result.completed,
                nextTurn: result.nextTurn,
                message: `Карта ${mapName} ${action === 'pick' ? 'выбрана' : 'забанена'}`
            });
            
        } catch (error) {
            console.error('❌ Ошибка выбора карты:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при выборе карты' 
            });
        }
    }
    
    // 📡 WebSocket подключение к лобби
    static async handleSocketConnection(io, socket) {
        socket.on('join_lobby', async (data) => {
            try {
                const { lobbyId, userId } = data;
                
                if (!lobbyId || !userId) {
                    socket.emit('error', { 
                        message: 'Необходимо указать lobbyId и userId' 
                    });
                    return;
                }
                
                await MatchLobbyService.subscribeToLobby(io, socket, lobbyId, userId);
                
            } catch (error) {
                console.error('❌ Ошибка подключения к лобби:', error);
                socket.emit('error', { 
                    message: error.message || 'Ошибка подключения к лобби' 
                });
            }
        });
        
        socket.on('leave_lobby', (data) => {
            const { lobbyId } = data;
            if (lobbyId) {
                socket.leave(`lobby_${lobbyId}`);
                console.log(`👋 Пользователь покинул лобби ${lobbyId}`);
            }
        });
    }
    // 📨 Повторная отправка приглашений в лобби
    static async resendLobbyInvitations(req, res) {
        try {
            const { tournamentId, lobbyId } = req.params;
            const userId = req.user.id;
            
            // Проверяем права доступа
            const isAdmin = await req.checkTournamentAccess(tournamentId, userId);
            if (!isAdmin) {
                return res.status(403).json({ 
                    error: 'У вас нет прав для управления лобби' 
                });
            }
            
            const io = req.app.get('io');
            const result = await MatchLobbyService.resendLobbyInvitations(lobbyId, io);
            
            res.json({
                success: true,
                invitationsSent: result.invitationsSent,
                message: `Приглашения отправлены повторно (${result.invitationsSent} участников)`
            });
            
        } catch (error) {
            console.error('❌ Ошибка повторной отправки приглашений:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при отправке приглашений' 
            });
        }
    }

    // 🔎 Получить активное лобби пользователя в турнире
    static async getUserActiveLobby(req, res) {
        try {
            const { tournamentId } = req.params;
            const userId = req.user.id;
            
            const lobby = await MatchLobbyService.getUserActiveLobbyInTournament(userId, tournamentId);
            
            if (!lobby) {
                return res.json({
                    success: true,
                    hasLobby: false
                });
            }
            
            res.json({
                success: true,
                hasLobby: true,
                lobby: {
                    id: lobby.id,
                    match_id: lobby.match_id,
                    status: lobby.status,
                    expired: lobby.expired,
                    age_hours: lobby.age_hours
                }
            });
            
        } catch (error) {
            console.error('❌ Ошибка получения активного лобби:', error);
            res.status(500).json({ 
                error: error.message || 'Ошибка при получении лобби' 
            });
        }
    }
}

module.exports = MatchLobbyController; 