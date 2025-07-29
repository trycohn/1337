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
const { authenticateToken, verifyEmailRequired, verifyAdminOrCreator } = require('../../middleware/auth');
const TournamentController = require('../../controllers/tournament/TournamentController');
const ParticipantController = require('../../controllers/tournament/ParticipantController');
const MatchController = require('../../controllers/tournament/MatchController');
const AdminController = require('../../controllers/tournament/AdminController');
const ChatController = require('../../controllers/tournament/ChatController');
const MixTeamController = require('../../controllers/tournament/MixTeamController');
const { BracketController } = require('../../controllers/tournament/BracketController');
const MatchLobbyController = require('../../controllers/matchLobby/MatchLobbyController');

const router = express.Router();

// 📋 **ОСНОВНЫЕ ТУРНИРНЫЕ ОПЕРАЦИИ**

// Получение списка игр (ДОЛЖНО БЫТЬ ПЕРЕД /:id!)
router.get('/games', TournamentController.getGames);

// 🎯 Получение доступных типов распределения (ДОЛЖНО БЫТЬ ПЕРЕД /:id!)
router.get('/seeding-types', BracketController.getSeedingTypes);

// Получение всех турниров
router.get('/', TournamentController.getAllTournaments);

// Получение турнира по ID
router.get('/:id', TournamentController.getTournamentById);

// Создание нового турнира
router.post('/', authenticateToken, verifyEmailRequired, TournamentController.createTournament);

// 🗑️ Удаление турнира
router.delete('/:id', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.deleteTournament);

// ⚖️ Обновление регламента турнира
router.put('/:id/rules', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateRules);

// 📝 Обновление описания турнира  
router.put('/:id/description', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateDescription);

// 🎯 Обновление типа рейтинга для микс-турниров
router.put('/:id/rating-type', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateRatingType);

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

// Сохранение результата матча
router.post('/:id/matches/:matchId/result', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.saveMatchResult);

// 👥 **УПРАВЛЕНИЕ УЧАСТНИКАМИ** (БАЗОВЫЕ МЕТОДЫ)

// Участие в турнире
router.post('/:id/participate', authenticateToken, verifyEmailRequired, ParticipantController.participateInTournament);

// Отмена участия
router.delete('/:id/participate', authenticateToken, verifyEmailRequired, ParticipantController.withdrawFromTournament);

// 👤 Ручное добавление незарегистрированного участника (для администраторов)
router.post('/:id/add-participant', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.addParticipant);

// 🗑️ Удаление участника (для администраторов)
router.delete('/:id/participants/:participantId', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.removeParticipant);

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

// ===========================================
// 🎮 РОУТЫ ЛОББИ МАТЧЕЙ (CS2)
// ===========================================

// 🔧 Обновление настроек лобби для турнира
router.put('/:id/lobby-settings', authenticateToken, verifyAdminOrCreator, MatchLobbyController.updateLobbySettings);

// 🏁 Создание лобби для матча
router.post('/:tournamentId/matches/:matchId/create-lobby', authenticateToken, verifyAdminOrCreator, MatchLobbyController.createMatchLobby);

// 🎯 Получение информации о лобби
router.get('/lobby/:lobbyId', authenticateToken, MatchLobbyController.getLobbyInfo);

// ✅ Установка готовности участника
router.post('/lobby/:lobbyId/ready', authenticateToken, MatchLobbyController.setReadyStatus);

// 🎲 Назначение первого выбирающего (только админ)
router.post('/lobby/:lobbyId/set-first-picker', authenticateToken, verifyAdminOrCreator, MatchLobbyController.setFirstPicker);

// 🗺️ Выбор или бан карты
router.post('/lobby/:lobbyId/select-map', authenticateToken, MatchLobbyController.selectMap);

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