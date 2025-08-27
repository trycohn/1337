// 🎮 MatchLobbyController - Контроллер управления лобби матчей
const MatchLobbyService = require('../../services/matchLobby/MatchLobbyService');

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

    // 🔎 Получение активных лобби для текущего пользователя
    static async getActiveLobbiesForUser(req, res) {
        try {
            const userId = req.user.id;
            const lobbies = await MatchLobbyService.getActiveLobbiesForUser(userId);
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
            
            res.json({
                success: true,
                lobby
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
            
            const lobby = await MatchLobbyService.setReadyStatus(
                lobbyId, 
                userId, 
                ready
            );
            
            // Отправляем обновление всем участникам
            const io = req.app.get('io');
            if (io) {
                await MatchLobbyService.broadcastLobbyUpdate(io, lobbyId);
            }
            
            res.json({
                success: true,
                lobby,
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
}

module.exports = MatchLobbyController; 