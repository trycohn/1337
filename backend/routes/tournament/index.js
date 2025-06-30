// backend/routes/tournament/index.js
//
// 🏗️ МОДУЛЬНАЯ АРХИТЕКТУРА ТУРНИРОВ v2.0
// ===================================
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
//

const express = require('express');
const { authenticateToken, verifyEmailRequired, verifyAdminOrCreator } = require('../../middleware/auth');
const TournamentController = require('../../controllers/tournament/TournamentController');
const ParticipantController = require('../../controllers/tournament/ParticipantController');
const MatchController = require('../../controllers/tournament/MatchController');
const AdminController = require('../../controllers/tournament/AdminController');
const ChatController = require('../../controllers/tournament/ChatController');
const MixTeamController = require('../../controllers/tournament/MixTeamController');

const router = express.Router();

// 📋 **ОСНОВНЫЕ ТУРНИРНЫЕ ОПЕРАЦИИ**

// 🔧 ВАЖНО: СПЕЦИФИЧНЫЕ МАРШРУТЫ ДОЛЖНЫ БЫТЬ ПЕРЕД ОБЩИМИ!
// Это исправляет ошибку когда /games интерпретировался как /:id

// Получение списка игр (ДОЛЖНО БЫТЬ ПЕРЕД /:id!)
router.get('/games/list', TournamentController.getGames);

// 🔧 АЛИАС ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ: старый путь /games
router.get('/games', TournamentController.getGames);

// Получение всех турниров
router.get('/', TournamentController.getAllTournaments);

// Получение турнира по ID (ПОСЛЕ специфичных маршрутов!)
router.get('/:id', TournamentController.getTournamentById);

// Создание нового турнира (требует авторизации)
router.post('/', authenticateToken, verifyEmailRequired, TournamentController.createTournament);

// Обновление турнира (требует авторизации)
router.put('/:id', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateTournament);

// Удаление турнира (требует авторизации)
router.delete('/:id', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.deleteTournament);

// Начало турнира (требует авторизации)
router.post('/:id/start', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.startTournament);

// Сброс результатов матчей
router.post('/:id/reset-match-results', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.resetMatchResults);

// Получение команд турнира
router.get('/:id/teams', ParticipantController.getTeams);

// 📝 **ОБНОВЛЕНИЯ СОДЕРЖИМОГО ТУРНИРА**

// Обновление описания
router.put('/:id/description', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateDescription);

// Обновление полного описания
router.put('/:id/full-description', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateFullDescription);

// Обновление регламента
router.put('/:id/rules', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updateRules);

// Обновление призового фонда
router.put('/:id/prize-pool', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, TournamentController.updatePrizePool);

// Обновление размера команды
router.put('/:id/team-size', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, ParticipantController.updateTeamSize);

// 🔄 **УПРАВЛЕНИЕ МИКС КОМАНДАМИ**

// Генерация микс команд (основной метод)
router.post('/:id/mix-generate-teams', authenticateToken, verifyAdminOrCreator, ParticipantController.generateMixTeams);

// Переформирование микс команд (основной метод)
router.post('/:id/mix-regenerate-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.regenerateTeams);

// Получение оригинальных участников для микс турниров (группированные по статусу в командах)
router.get('/:id/mix-original-participants', MixTeamController.getOriginalParticipants);

// Обновление размера команды специально для микс турниров
router.patch('/:id/mix-team-size', authenticateToken, verifyAdminOrCreator, MixTeamController.updateTeamSize);

// Очистка команд микс турнира
router.post('/:id/mix-clear-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.clearMixTeams);

// 🆕 АЛИАСЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ с фронтендом
router.post('/:id/form-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.formTeamsAlias);  // Алиас для mix-generate-teams
router.get('/:id/original-participants', MixTeamController.getOriginalParticipantsAlias);  // Алиас для mix-original-participants

// 🆕 ДОПОЛНИТЕЛЬНЫЕ АЛИАСЫ ДЛЯ СТАРЫХ МЕТОДОВ
router.post('/:id/generate-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.generateMixTeams);  // Старый алиас для генерации

// 👥 **УПРАВЛЕНИЕ УЧАСТНИКАМИ**

// Участие в турнире
router.post('/:id/participate', authenticateToken, verifyEmailRequired, ParticipantController.participateInTournament);

// Отмена участия
router.delete('/:id/participate', authenticateToken, verifyEmailRequired, ParticipantController.withdrawFromTournament);

// Получение участников турнира
router.get('/:id/participants', TournamentController.getOriginalParticipants);

// Удаление участника (для администраторов)
router.delete('/:id/participants/:participantId', authenticateToken, verifyAdminOrCreator, ParticipantController.removeParticipant);

// 🥊 **УПРАВЛЕНИЕ МАТЧАМИ И СЕТКАМИ**

// Генерация турнирной сетки
router.post('/:id/generate-bracket', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.generateBracket);

// Регенерация турнирной сетки
router.post('/:id/regenerate-bracket', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.regenerateBracket);

// Обновление результата матча в рамках турнира
router.post('/:id/matches/:matchId/result', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.updateMatchResult);

// 🆕 Прямое обновление результата матча по ID матча (для совместимости с фронтендом)
router.post('/matches/:matchId/result', authenticateToken, verifyEmailRequired, verifyAdminOrCreator, MatchController.updateSpecificMatchResult);

// Получение матчей турнира
router.get('/:id/matches', MatchController.getMatches);

// Получение конкретного матча
router.get('/matches/:matchId', MatchController.getMatchById);

// 🧹 Проверка дублирующихся матчей
router.get('/:id/matches/check-duplicates', authenticateToken, verifyAdminOrCreator, MatchController.checkDuplicateMatches);

// 🧹 Очистка дублирующихся матчей
router.post('/:id/matches/cleanup-duplicates', authenticateToken, verifyAdminOrCreator, MatchController.cleanupDuplicateMatches);

// 🔧 Диагностика блокировок базы данных (только для администраторов)
router.get('/:id/check-database-locks', authenticateToken, verifyAdminOrCreator, MatchController.checkDatabaseLocks);

// 🔧 Очистка заблокированных процессов БД (только для администраторов)
router.post('/:id/clear-stuck-locks', authenticateToken, verifyAdminOrCreator, MatchController.clearStuckLocks);

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
router.post('/:id/accept-admin-invitation', authenticateToken, verifyAdminOrCreator, AdminController.acceptAdminInvitation);

// Отклонение приглашения администратора
router.post('/:id/decline-admin-invitation', authenticateToken, verifyAdminOrCreator, AdminController.declineAdminInvitation);

// Удаление администратора
router.delete('/:id/admins/:userId', authenticateToken, verifyAdminOrCreator, AdminController.removeAdmin);

// Очистка истекших приглашений (глобальная операция)
router.post('/admin-invitations/cleanup-expired', authenticateToken, verifyAdminOrCreator, AdminController.cleanupExpiredInvitations);

// Получение статистики приглашений (глобальная операция)
router.get('/admin-invitations/stats', authenticateToken, verifyAdminOrCreator, AdminController.getInvitationStats);

// 💬 **ЧАТ ТУРНИРА**

// Получение сообщений чата
router.get('/:id/chat/messages', authenticateToken, verifyAdminOrCreator, ChatController.getChatMessages);

// Получение участников чата
router.get('/:id/chat/participants', authenticateToken, verifyAdminOrCreator, ChatController.getChatParticipants);

// 🛠️ **ОБРАБОТКА ОШИБОК ТУРНИРОВ**
const { tournamentErrorHandler } = require('../../middleware/tournament/errorHandler');
router.use(tournamentErrorHandler);

module.exports = router; 