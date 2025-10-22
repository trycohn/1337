// backend/routes/tournament/index.js
//
// 🏗️ МОДУЛЬНАЯ АРХИТЕКТУРА ТУРНИРОВ v4.0 (БЕЗ ГЕНЕРАЦИИ СЕТКИ)
// ====================================================
// 
// Этот файл заменяет монолитный файл tournaments.js на модульную архитектуру
// по принципам Clean Architecture и разделения ответственности.
//
// 📁 Структура модулей:
// ├── 🎯 controllers/tournament/ - HTTP-слой (обработка запросов)
// ├── 🔧 services/tournament/   - Бизнес-логика
// ├── 🗄️ repositories/tournament/ - Слой данных (работа с БД)
// ├── ✅ validators/tournament/ - Валидация входящих данных
// └── 🛠️ utils/tournament/      - Вспомогательные утилиты
//
// ✨ Преимущества новой архитектуры:
// • Разделение ответственности между слоями
// • Улучшенная тестируемость кода
// • Легкое масштабирование функциональности
// • Соблюдение принципов SOLID
// • Централизованная обработка ошибок
// • Единообразная валидация данных
//
// 🔄 Миграция: Старый файл tournaments.js сохранен как tournaments.js.legacy.backup
// 🚫 v4.0: Удалены все функции генерации турнирной сетки
//

const express = require('express');
const pool = require('../../db');
const { authenticateToken, verifyEmailRequired, verifyAdminOrCreator } = require('../../middleware/auth');
const TournamentController = require('../../controllers/tournament/TournamentController');
const ParticipantController = require('../../controllers/tournament/ParticipantController');
const MatchController = require('../../controllers/tournament/MatchController');
const AdminController = require('../../controllers/tournament/AdminController');
const ChatController = require('../../controllers/tournament/ChatController');
const MixTeamController = require('../../controllers/tournament/MixTeamController');
const FullMixController = require('../../controllers/tournament/FullMixController');
const { BracketController } = require('../../controllers/tournament/BracketController');
const MatchLobbyController = require('../../controllers/matchLobby/MatchLobbyController');
const ShareController = require('../../controllers/tournament/ShareController');
const TournamentStatsController = require('../../controllers/tournament/TournamentStatsController');

const router = express.Router();

// 📋 **ОСНОВНЫЕ ТУРНИРНЫЕ ОПЕРАЦИИ**

// Получение списка игр (ДОЛЖНО БЫТЬ ПЕРЕД /:id!)
router.get('/games', TournamentController.getGames);

// 🎯 Получение доступных типов распределения (ДОЛЖНО БЫТЬ ПЕРЕД /:id!)
router.get('/seeding-types', BracketController.getSeedingTypes);

// Получение победителей турниров (ДОЛЖНО БЫТЬ ПЕРЕД /:id!)
router.get('/winners', TournamentController.getWinners);

// Получение всех турниров
router.get('/', TournamentController.getAllTournaments);

// 🆕 Мои турниры (создатель или администратор)
router.get('/my', authenticateToken, TournamentController.getMyTournaments);

// Получение турнира по ID
router.get('/:id', TournamentController.getTournamentById);

// 📊 Получение результатов турнира с правильной статистикой
router.get('/:id/results', TournamentController.getTournamentResults);

// Создание нового турнира
router.post('/', authenticateToken, verifyEmailRequired, TournamentController.createTournament);

// 🆕 Обновление флага финала серии
router.put('/:id/series-final-flag', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateSeriesFinalFlag);

// 🆕 Связи финал ↔ отборочные
router.put('/:id/qualifiers', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.setFinalQualifiers);
router.get('/:id/qualifiers', TournamentController.getFinalQualifiers);
router.post('/:id/qualifiers/sync', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.syncQualifiers);

// 🆕 Live‑поиск турниров
router.get('/search/live', TournamentController.searchTournaments);

// 🗑️ Удаление турнира
router.delete('/:id', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.deleteTournament);

// ⚖️ Обновление регламента турнира
router.put('/:id/rules', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateRules);

// 📝 Обновление описания турнира  
router.put('/:id/description', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateDescription);

// 🎯 Обновление типа рейтинга для микс-турниров
router.put('/:id/rating-type', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateRatingType);

// 🆕 Обновление требований привязки аккаунтов (MIX)
router.put('/:id/mix-link-requirements', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateMixLinkRequirements);

// 🎮 Обновление дисциплины турнира
router.put('/:id/game', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateGame);

// 🏆 Обновление формата турнира
router.put('/:id/format', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateFormat);

// 📅 Обновление даты старта турнира
router.put('/:id/start-date', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateStartDate);

// Обновление настроек лобби
router.put('/:id/lobby-enabled', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateLobbyEnabled);

// 🏆 Обновление типа турнирной сетки
router.put('/:id/bracket-type', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateBracketType);

// 👥 Обновление размера команды для микс-турниров
router.put('/:id/team-size', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateTeamSize);

// 🎮 **УПРАВЛЕНИЕ МАТЧАМИ** (БЕЗ ГЕНЕРАЦИИ СЕТКИ)

// Очистка результатов матчей
router.post('/:id/clear-match-results', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.clearMatchResults);

// Получение матчей турнира
router.get('/:id/matches', MatchController.getMatches);

// Получение конкретного матча
router.get('/:id/matches/:matchId', MatchController.getMatch);

// 🔗 Публичный роут для деталей матча (для шейринга)
router.get('/:id/match/:matchId', async (req, res) => {
    const { id: tournamentId, matchId } = req.params;
    
    console.log(`🔗 [Public Match Route] Запрос матча ${matchId} турнира ${tournamentId}`);
    
    try {
        // Простой запрос без сложных JOIN'ов
        const matchResult = await pool.query(`
            SELECT 
                m.*,
                t.name as tournament_name,
                t.game,
                t.type as tournament_type,
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
                    WHERE ms.lobby_id = (
                        SELECT id FROM match_lobbies WHERE match_id = m.id ORDER BY created_at DESC NULLS LAST LIMIT 1
                    )
                ) as selections
            FROM matches m
            JOIN tournaments t ON m.tournament_id = t.id
            WHERE m.id = $1 AND m.tournament_id = $2
        `, [parseInt(matchId), parseInt(tournamentId)]);
        
        if (matchResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Матч не найден'
            });
        }
        
        const match = matchResult.rows[0];
        
        // Получаем информацию об участниках отдельно
        let team1 = null, team2 = null;
        
        if (match.team1_id) {
            // Пробуем найти в командах
            const team1Result = await pool.query(`
                SELECT id, name, creator_id as user_id, 'team' as type
                FROM tournament_teams 
                WHERE id = $1
            `, [match.team1_id]);
            
            if (team1Result.rows.length > 0) {
                team1 = team1Result.rows[0];
                team1.avatar_url = null; // У команд нет аватаров
            } else {
                // Пробуем найти в участниках
                const participant1Result = await pool.query(`
                    SELECT tp.id, COALESCE(u.username, tp.name) as name, u.avatar_url, u.id as user_id, 'individual' as type
                    FROM tournament_participants tp
                    LEFT JOIN users u ON tp.user_id = u.id
                    WHERE tp.id = $1
                `, [match.team1_id]);
                
                if (participant1Result.rows.length > 0) {
                    team1 = participant1Result.rows[0];
                }
            }
        }
        
        if (match.team2_id) {
            // Пробуем найти в командах
            const team2Result = await pool.query(`
                SELECT id, name, creator_id as user_id, 'team' as type
                FROM tournament_teams 
                WHERE id = $1
            `, [match.team2_id]);
            
            if (team2Result.rows.length > 0) {
                team2 = team2Result.rows[0];
                team2.avatar_url = null; // У команд нет аватаров
            } else {
                // Пробуем найти в участниках
                const participant2Result = await pool.query(`
                    SELECT tp.id, COALESCE(u.username, tp.name) as name, u.avatar_url, u.id as user_id, 'individual' as type
                    FROM tournament_participants tp
                    LEFT JOIN users u ON tp.user_id = u.id
                    WHERE tp.id = $1
                `, [match.team2_id]);
                
                if (participant2Result.rows.length > 0) {
                    team2 = participant2Result.rows[0];
                }
            }
        }
        
        // Добавляем информацию об участниках к матчу
        match.team1 = team1;
        match.team2 = team2;
        match.team1_name = team1?.name || 'TBD';
        match.team2_name = team2?.name || 'TBD';
        
        // 🗺️ Добавляем согласованный маппул турнира (если задан при создании)
        try {
            const mapsRes = await pool.query(
                `SELECT 
                    tm.display_order,
                    tm.map_name,
                    lower(regexp_replace(tm.map_name, '^de[_-]?', '')) AS map_key_norm,
                    COALESCE(m.display_name, tm.map_name) AS display_name,
                    m.image_url
                 FROM tournament_maps tm
                 LEFT JOIN maps m
                   ON lower(regexp_replace(m.name, '^de[_-]?', '')) = lower(regexp_replace(tm.map_name, '^de[_-]?', ''))
                 WHERE tm.tournament_id = $1
                 ORDER BY tm.display_order ASC, tm.id ASC`,
                [parseInt(tournamentId)]
            );

            const details = (mapsRes.rows || []).map(r => ({
                order: r.display_order,
                name: r.map_name,
                key: r.map_key_norm,
                display_name: r.display_name,
                image_url: r.image_url || null
            }));
            match.available_map_details = details;
            match.available_maps = details.map(d => d.key);
        } catch (e) {
            console.warn('⚠️ Не удалось получить tournament_maps:', e.message);
            match.available_map_details = [];
            match.available_maps = [];
        }

        // Если пул карт пуст, используем дефолтный маппул из таблицы default_map_pool
        if (!match.available_map_details || match.available_map_details.length === 0) {
            try {
                const poolRes = await pool.query(`
                    SELECT map_name AS key, display_order
                    FROM default_map_pool
                    ORDER BY display_order ASC, id ASC
                `);
                const fallbackKeys = (poolRes.rows || []).map(r => r.key);

                // Получаем display_name и image_url из таблицы maps, если есть
                const mapsMetaRes = await pool.query(
                    `SELECT 
                        lower(regexp_replace(name, '^de[_-]?', '')) AS key,
                        COALESCE(display_name, name) AS display_name,
                        image_url
                     FROM maps
                     WHERE lower(regexp_replace(name, '^de[_-]?', '')) = ANY($1)`,
                    [fallbackKeys]
                );
                const metaByKey = new Map((mapsMetaRes.rows || []).map(r => [r.key, r]));

                match.available_map_details = fallbackKeys.map((key, idx) => {
                    const meta = metaByKey.get(key);
                    const fallbackDisplay = (key === 'dust2' ? 'Dust II' : key.charAt(0).toUpperCase() + key.slice(1));
                    return {
                        order: idx + 1,
                        name: key,
                        key,
                        display_name: (meta && meta.display_name) || fallbackDisplay,
                        image_url: meta ? meta.image_url : null
                    };
                });
                match.available_maps = fallbackKeys;
            } catch (e) {
                console.warn('⚠️ Ошибка подготовки дефолтного маппула:', e.message);
                match.available_map_details = [];
                match.available_maps = [];
            }
        }

        console.log(`✅ [Public Match Route] Матч найден: ${match.team1_name} vs ${match.team2_name}`);
        
        res.json({
            success: true,
            data: match
        });
        
    } catch (error) {
        console.error(`❌ [Public Match Route] Ошибка:`, error.message);
        res.status(500).json({
            success: false,
            message: 'Ошибка получения данных матча',
            error: error.message
        });
    }
});

// Генерация изображения для шейринга матча
router.get('/:id/match/:matchId/share-image', ShareController.generateMatchShareImage);

// Сохранение результата матча
router.post('/:id/matches/:matchId/result', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.saveMatchResult);

// Редактирование результата завершенного матча
router.put('/:id/matches/:matchId/result', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.editMatchResult);

// 👥 **УПРАВЛЕНИЕ УЧАСТНИКАМИ** (БАЗОВЫЕ МЕТОДЫ)

// Участие в турнире
router.post('/:id/participate', authenticateToken, verifyEmailRequired, ParticipantController.participateInTournament);

// Отмена участия
router.delete('/:id/participate', authenticateToken, verifyEmailRequired, ParticipantController.withdrawFromTournament);

// 👤 Ручное добавление незарегистрированного участника (для администраторов)
router.post('/:id/add-participant', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.addParticipant);

// 👥 Ручное добавление незарегистрированной команды с игроками (для администраторов командных турниров)
router.post('/:id/add-team', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.addTeamWithPlayers);

// 🔧 УПРАВЛЕНИЕ СОСТАВОМ КОМАНД
const TeamMemberController = require('../../controllers/tournament/TeamMemberController');
// Добавить участника в команду
router.post('/:id/teams/:teamId/members', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TeamMemberController.addTeamMember);
// Удалить участника из команды
router.delete('/:id/teams/:teamId/members/:participantId', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TeamMemberController.removeTeamMember);
// Получить состав команды
router.get('/:id/teams/:teamId/members', authenticateToken, TeamMemberController.getTeamMembers);

// 📋 ЛИСТ ОЖИДАНИЯ
const WaitingListController = require('../../controllers/tournament/WaitingListController');
// Присоединиться к листу ожидания (для игроков)
router.post('/:id/waiting-list/join', authenticateToken, verifyEmailRequired, WaitingListController.joinWaitingList);
// Получить список ожидающих (для админов)
router.get('/:id/waiting-list', authenticateToken, verifyAdminOrCreator, WaitingListController.getWaitingList);
// Назначить игрока из листа в команду (для админов)
router.post('/:id/waiting-list/:participantId/assign', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, WaitingListController.assignToTeam);

// 🗑️ Удаление участника (для администраторов)
router.delete('/:id/participants/:participantId', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.removeParticipant);

// ✏️ Обновление имени незарегистрированного участника (для администраторов)
router.put('/:id/participants/:participantId/name', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.updateParticipantName);

// 📧 Отправка приглашения в турнир (для администраторов)
router.post('/:id/invite', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.inviteToTournament);

// 🤝 Обработка приглашения в турнир
router.post('/:id/handle-invitation', authenticateToken, verifyEmailRequired, ParticipantController.handleInvitation);

// 🔄 **УПРАВЛЕНИЕ МИКС КОМАНДАМИ** (БАЗОВЫЕ МЕТОДЫ)

// Генерация микс команд
router.post('/:id/mix-generate-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.generateMixTeams);

// 🔄 Алиас для обратной совместимости (frontend ожидает form-teams)
router.post('/:id/form-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.generateMixTeams);

// 🔄 Переформирование микс команд
router.post('/:id/mix-regenerate-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.regenerateMixTeams);

// 👥 Обновление размера команды для микс-турниров
router.patch('/:id/mix-team-size', authenticateToken, verifyAdminOrCreator, MixTeamController.updateTeamSize);

// 🏆 Получение команд турнира
router.get('/:id/teams', MixTeamController.getTeams);

// 🆕 Карта составов команд для сетки (team_id -> roster)
router.get('/:id/team-rosters', MixTeamController.getTeamRosters);

// Получение оригинальных участников
router.get('/:id/original-participants', MixTeamController.getOriginalParticipants);

// 👑 **УПРАВЛЕНИЕ КАПИТАНАМИ КОМАНД** (НОВАЯ СИСТЕМА v4.8)

// Назначение капитана команды
router.post('/:id/teams/:teamId/set-captain', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MixTeamController.setCaptain);

// Получение информации о капитане команды
router.get('/:id/teams/:teamId/captain', MixTeamController.getTeamCaptain);

// Автоматическое назначение капитана по рейтингу
router.post('/:id/teams/:teamId/auto-assign-captain', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MixTeamController.autoAssignCaptain);

// Массовое назначение капитанов для всех команд турнира
router.post('/:id/assign-all-captains', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MixTeamController.assignAllCaptains);

// Получение статистики по капитанам турнира
router.get('/:id/captains-stats', MixTeamController.getCaptainsStats);

// Проверка является ли пользователь капитаном команды
router.get('/:id/teams/:teamId/is-captain/:userId', MixTeamController.isUserCaptain);

// Миграция существующих команд (назначение капитанов)
router.post('/:id/migrate-captains', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MixTeamController.migrateCaptains);

// 🔄 **УПРАВЛЕНИЕ ТУРНИРОМ** (БАЗОВЫЕ МЕТОДЫ)

// Запуск турнира
router.post('/:id/start', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.startTournament);

// Завершение турнира
router.post('/:id/end', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.endTournament);

// 🛡️ **АДМИНИСТРАТИВНЫЕ ФУНКЦИИ**

// Запрос на администрирование
router.post('/:id/request-admin', authenticateToken, verifyAdminOrCreator, AdminController.requestAdmin);

// Получение статуса запроса на администрирование
router.get('/:id/admin-request-status', authenticateToken, verifyAdminOrCreator, AdminController.getAdminRequestStatus);

// Ответ на запрос администрирования
router.post('/:id/respond-admin-request', authenticateToken, verifyAdminOrCreator, AdminController.respondToAdminRequest);

// Приглашение администратора
router.post('/:id/invite-admin', authenticateToken, verifyAdminOrCreator, AdminController.inviteAdmin);

// Принятие приглашения администратора
router.post('/:id/accept-admin-invitation', authenticateToken, verifyEmailRequired, AdminController.acceptAdminInvitation);

// Отклонение приглашения администратора
router.post('/:id/decline-admin-invitation', authenticateToken, verifyEmailRequired, AdminController.declineAdminInvitation);

// Удаление администратора
router.delete('/:id/admins/:userId', authenticateToken, verifyAdminOrCreator, AdminController.removeAdmin);

// Очистка истекших приглашений (глобальная операция)
router.post('/admin-invitations/cleanup-expired', authenticateToken, verifyAdminOrCreator, AdminController.cleanupExpiredInvitations);

// 📧 Получение приглашений администратора для текущего пользователя
router.get('/admin-invitations/my', authenticateToken, AdminController.getUserInvitations);

// Получение статистики приглашений (глобальная операция)
router.get('/admin-invitations/stats', authenticateToken, verifyAdminOrCreator, AdminController.getInvitationStats);

// 💬 **ЧАТ ТУРНИРА**

// Получение сообщений чата
router.get('/:id/chat/messages', authenticateToken, verifyAdminOrCreator, ChatController.getChatMessages);

// Получение участников чата
router.get('/:id/chat/participants', authenticateToken, verifyAdminOrCreator, ChatController.getChatParticipants);

// ===========================================
// 🏗️ РОУТЫ ТУРНИРНОЙ СЕТКИ (НОВАЯ СИСТЕМА)
// ===========================================

// 🚀 Генерация турнирной сетки
router.post('/:id/generate-bracket', authenticateToken, verifyAdminOrCreator, BracketController.generateBracket);

// 🔄 Регенерация турнирной сетки
router.post('/:id/regenerate-bracket', authenticateToken, verifyAdminOrCreator, BracketController.regenerateBracket);

// 🎲 Предварительный просмотр распределения участников
router.get('/:id/seeding-preview', authenticateToken, verifyAdminOrCreator, BracketController.previewSeeding);

// 📊 Статистика турнирной сетки
router.get('/:id/bracket-statistics', authenticateToken, verifyAdminOrCreator, BracketController.getBracketStatistics);

// 🗑️ Очистка результатов турнирной сетки
router.post('/:id/clear-bracket-results', authenticateToken, verifyAdminOrCreator, BracketController.clearBracketResults);

// 🆕 Ручное редактирование сетки
router.post('/:id/manual-bracket-edit', authenticateToken, verifyAdminOrCreator, TournamentController.manualBracketEdit);

// ===========================================
// 🎮 РОУТЫ ЛОББИ МАТЧЕЙ (CS2)
// ===========================================

// 🔧 Обновление настроек лобби для турнира
router.put('/:id/lobby-settings', authenticateToken, verifyAdminOrCreator, MatchLobbyController.updateLobbySettings);

// 🏁 Создание лобби для матча
router.post('/:tournamentId/matches/:matchId/create-lobby', authenticateToken, verifyAdminOrCreator, MatchLobbyController.createMatchLobby);

// 🔄 Пересоздание лобби для матча
router.post('/:tournamentId/matches/:matchId/recreate-lobby', authenticateToken, verifyAdminOrCreator, MatchLobbyController.recreateMatchLobby);

// 🔎 Получить активное лобби матча (если есть)
router.get('/:tournamentId/matches/:matchId/active-lobby', authenticateToken, MatchLobbyController.getActiveLobbyByMatch);

// 🔎 Получить активные лобби для набора матчей (батч)
router.post('/:tournamentId/matches/active-lobbies', authenticateToken, MatchLobbyController.getActiveLobbiesBatch);

// 🔎 Получить список активных лобби для текущего пользователя
router.get('/lobbies/active', authenticateToken, MatchLobbyController.getActiveLobbiesForUser);

// 🎯 Получение информации о лобби
router.get('/lobby/:lobbyId', authenticateToken, MatchLobbyController.getLobbyInfo);

// ✅ Установка готовности участника
router.post('/lobby/:lobbyId/ready', authenticateToken, MatchLobbyController.setReadyStatus);

// 🎲 Назначение первого выбирающего (только админ)
router.post('/lobby/:lobbyId/set-first-picker', authenticateToken, verifyAdminOrCreator, MatchLobbyController.setFirstPicker);

// 🗺️ Выбор или бан карты
router.post('/lobby/:lobbyId/select-map', authenticateToken, MatchLobbyController.selectMap);

// 🚀 Ручной запуск процедуры пик/бан (админ турнира или капитаны)
router.post('/lobby/:lobbyId/start-pickban', authenticateToken, MatchLobbyController.startPickBan);

// 📨 Повторная отправка приглашений в лобби
router.post('/:tournamentId/lobby/:lobbyId/resend-invites', authenticateToken, verifyAdminOrCreator, MatchLobbyController.resendLobbyInvitations);

// 🔎 Получить активное лобби пользователя в турнире
router.get('/:tournamentId/my-active-lobby', authenticateToken, MatchLobbyController.getUserActiveLobby);

// ===========================================
// 🆕 FULL MIX (без классической сетки)
// ===========================================
router.post('/:id/fullmix/start', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.start);
router.post('/:id/fullmix/generate-next', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.generateNext);
router.post('/:id/fullmix/complete-round', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.completeRound);
router.get('/:id/fullmix/standings', FullMixController.standings);
router.get('/:id/fullmix/snapshots', FullMixController.snapshots);
router.get('/:id/fullmix/rounds/:round', FullMixController.getRound);
router.post('/:id/fullmix/rounds/:round/approve', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.approve);
router.post('/:id/fullmix/rounds/:round/reshuffle', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.reshuffle);
router.post('/:id/fullmix/rounds/:round/redraft', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.redraft);
router.post('/:id/fullmix/rounds/:round/confirm-rosters', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.confirmRosters);
router.get('/:id/fullmix/settings', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.settings);
router.put('/:id/fullmix/settings', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.settings);
// PREVIEW (черновики раундов): только админы/создатели
router.post('/:id/fullmix/rounds/:round/preview', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.createPreview);
router.get('/:id/fullmix/rounds/:round/preview', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.getPreview);
router.delete('/:id/fullmix/rounds/:round/preview', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.deletePreview);

// 🆕 Управление выбывшими (админ)
router.get('/:id/fullmix/eliminated', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.getEliminated);
router.post('/:id/fullmix/eliminated', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.addEliminated);
router.delete('/:id/fullmix/eliminated', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.deleteEliminated);
router.post('/:id/fullmix/eliminated/recover', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, FullMixController.recoverEliminated);

// 📊 **СТАТИСТИКА ТУРНИРОВ (НОВОЕ v4.28.0)**

// 🏆 Получение итоговой таблицы мест команд (публичный)
router.get('/:id/standings', async (req, res) => {
    try {
        const StandingsService = require('../../services/tournament/StandingsService');
        const result = await StandingsService.getTournamentStandings(parseInt(req.params.id));
        res.json(result);
    } catch (error) {
        console.error('❌ [Standings] Ошибка:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📊 Получение полной статистики турнира (публичный)
router.get('/:id/stats', TournamentStatsController.getTournamentStats);

// 🏆 Получение MVP турнира (публичный)
router.get('/:id/stats/mvp', TournamentStatsController.getMVP);

// 📈 Получение лидерборда по категории (публичный)
// Категории: most_kills, highest_adr, best_hs, clutch_king, eco_master, most_assists, best_accuracy
router.get('/:id/stats/leaderboard', TournamentStatsController.getLeaderboard);

// 👤 Получение статистики конкретного игрока в турнире (публичный)
router.get('/:id/stats/player/:userId', TournamentStatsController.getPlayerStats);

// 🔄 Полный пересчет статистики турнира (только админ/создатель)
router.post('/:id/stats/recalculate', authenticateToken, TournamentStatsController.recalculateStats);

// 🏆 Финализация турнира: определение MVP и достижений (только админ/создатель)
router.post('/:id/stats/finalize', authenticateToken, TournamentStatsController.finalizeTournament);

// 📊 **МОНИТОРИНГ И ДИАГНОСТИКА**

// 🔍 WebSocket статистика (только для разработки и администраторов)
router.get('/websocket/stats', authenticateToken, async (req, res) => {
    try {
        const websocketMonitor = require('../../utils/tournament/websocketMonitor');
        const stats = websocketMonitor.getStats();
        
        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Ошибка получения WebSocket статистики:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения статистики WebSocket'
        });
    }
});

module.exports = router; 