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
const TournamentController = require('../../controllers/tournament/TournamentController');
const ParticipantController = require('../../controllers/tournament/ParticipantController');
const MatchController = require('../../controllers/tournament/MatchController');
const AdminController = require('../../controllers/tournament/AdminController');
const ChatController = require('../../controllers/tournament/ChatController');
const MixTeamController = require('../../controllers/tournament/MixTeamController');
const { authenticateToken } = require('../../middleware/auth');

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
router.post('/', authenticateToken, TournamentController.createTournament);

// Обновление турнира (требует авторизации)
router.put('/:id', authenticateToken, TournamentController.updateTournament);

// Удаление турнира (требует авторизации)
router.delete('/:id', authenticateToken, TournamentController.deleteTournament);

// Начало турнира (требует авторизации)
router.post('/:id/start', authenticateToken, TournamentController.startTournament);

// Сброс результатов матчей
router.post('/:id/reset-match-results', authenticateToken, TournamentController.resetMatchResults);

// Получение команд турнира
router.get('/:id/teams', TournamentController.getTeams);

// 📝 **ОБНОВЛЕНИЯ СОДЕРЖИМОГО ТУРНИРА**

// Обновление описания
router.put('/:id/description', authenticateToken, TournamentController.updateDescription);

// Обновление полного описания
router.put('/:id/full-description', authenticateToken, TournamentController.updateFullDescription);

// Обновление регламента
router.put('/:id/rules', authenticateToken, TournamentController.updateRules);

// Обновление призового фонда
router.put('/:id/prize-pool', authenticateToken, TournamentController.updatePrizePool);

// Обновление размера команды
router.put('/:id/team-size', authenticateToken, TournamentController.updateTeamSize);

// 🔄 **УПРАВЛЕНИЕ МИКС КОМАНДАМИ**

// Генерация микс команд (основной метод)
router.post('/:id/mix-generate-teams', authenticateToken, MixTeamController.formTeams);

// Переформирование микс команд (основной метод)
router.post('/:id/mix-regenerate-teams', authenticateToken, MixTeamController.regenerateTeams);

// Получение оригинальных участников для микс турниров (группированные по статусу в командах)
router.get('/:id/mix-original-participants', MixTeamController.getOriginalParticipants);

// Обновление размера команды специально для микс турниров
router.patch('/:id/mix-team-size', authenticateToken, MixTeamController.updateTeamSize);

// Очистка команд микс турнира
router.post('/:id/mix-clear-teams', authenticateToken, MixTeamController.clearMixTeams);

// 🆕 АЛИАСЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ с фронтендом
router.post('/:id/form-teams', authenticateToken, MixTeamController.formTeamsAlias);  // Алиас для mix-generate-teams
router.get('/:id/original-participants', MixTeamController.getOriginalParticipantsAlias);  // Алиас для mix-original-participants

// 🆕 ДОПОЛНИТЕЛЬНЫЕ АЛИАСЫ ДЛЯ СТАРЫХ МЕТОДОВ
router.post('/:id/generate-teams', authenticateToken, MixTeamController.generateMixTeams);  // Старый алиас для генерации

// 👥 **УПРАВЛЕНИЕ УЧАСТНИКАМИ**

// Участие в турнире
router.post('/:id/participate', authenticateToken, ParticipantController.participateInTournament);

// Отмена участия
router.delete('/:id/participate', authenticateToken, ParticipantController.withdrawFromTournament);

// Получение участников турнира
router.get('/:id/participants', TournamentController.getOriginalParticipants);

// Удаление участника (для администраторов)
router.delete('/:id/participants/:participantId', authenticateToken, ParticipantController.removeParticipant);

// 🥊 **УПРАВЛЕНИЕ МАТЧАМИ И СЕТКАМИ**

// Генерация турнирной сетки
router.post('/:id/generate-bracket', authenticateToken, MatchController.generateBracket);

// Регенерация турнирной сетки
router.post('/:id/regenerate-bracket', authenticateToken, MatchController.regenerateBracket);

// Обновление результата матча в рамках турнира
router.put('/:id/matches/:matchId/result', authenticateToken, MatchController.updateMatchResult);

// 🆕 Прямое обновление результата матча по ID матча (для совместимости с фронтендом)
router.post('/matches/:matchId/result', authenticateToken, MatchController.updateSpecificMatchResult);

// Получение матчей турнира
router.get('/:id/matches', MatchController.getMatches);

// Получение конкретного матча
router.get('/matches/:matchId', MatchController.getMatchById);

// 🧹 Проверка дублирующихся матчей
router.get('/:id/matches/check-duplicates', authenticateToken, MatchController.checkDuplicateMatches);

// 🧹 Очистка дублирующихся матчей
router.post('/:id/matches/cleanup-duplicates', authenticateToken, MatchController.cleanupDuplicateMatches);

// 🔧 Диагностика блокировок базы данных (только для администраторов)
router.get('/:id/matches/check-database-locks', authenticateToken, MatchController.checkDatabaseLocks);

// 🛡️ **АДМИНИСТРАТИВНЫЕ ФУНКЦИИ**

// Запрос на администрирование
router.post('/:id/request-admin', authenticateToken, AdminController.requestAdmin);

// Получение статуса запроса на администрирование
router.get('/:id/admin-request-status', authenticateToken, AdminController.getAdminRequestStatus);

// Ответ на запрос администрирования
router.post('/:id/respond-admin-request', authenticateToken, AdminController.respondToAdminRequest);

// Приглашение администратора
router.post('/:id/invite-admin', authenticateToken, AdminController.inviteAdmin);

// Принятие приглашения администратора
router.post('/:id/accept-admin-invitation', authenticateToken, AdminController.acceptAdminInvitation);

// Отклонение приглашения администратора
router.post('/:id/decline-admin-invitation', authenticateToken, AdminController.declineAdminInvitation);

// Удаление администратора
router.delete('/:id/admins/:userId', authenticateToken, AdminController.removeAdmin);

// Очистка истекших приглашений (глобальная операция)
router.post('/admin-invitations/cleanup-expired', authenticateToken, AdminController.cleanupExpiredInvitations);

// Получение статистики приглашений (глобальная операция)
router.get('/admin-invitations/stats', authenticateToken, AdminController.getInvitationStats);

// 💬 **ЧАТ ТУРНИРА**

// Получение сообщений чата
router.get('/:id/chat/messages', authenticateToken, ChatController.getChatMessages);

// Получение участников чата
router.get('/:id/chat/participants', authenticateToken, ChatController.getChatParticipants);

// 🛠️ **ОБРАБОТКА ОШИБОК ТУРНИРОВ**
const { tournamentErrorHandler } = require('../../middleware/tournament/errorHandler');
router.use(tournamentErrorHandler);

module.exports = router; 