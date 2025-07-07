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

// 🥊 **УПРАВЛЕНИЕ МАТЧАМИ** (БЕЗ ГЕНЕРАЦИИ СЕТКИ)

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

// 🔄 **УПРАВЛЕНИЕ МИКС КОМАНДАМИ** (БАЗОВЫЕ МЕТОДЫ)

// Генерация микс команд
router.post('/:id/mix-generate-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.generateMixTeams);

// 🔄 Алиас для обратной совместимости (frontend ожидает form-teams)
router.post('/:id/form-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.generateMixTeams);

// 🔄 Переформирование микс команд
router.post('/:id/mix-regenerate-teams', authenticateToken, verifyAdminOrCreator, MixTeamController.regenerateMixTeams);

// 🏆 Получение команд турнира
router.get('/:id/teams', MixTeamController.getTeams);

// Получение оригинальных участников
router.get('/:id/original-participants', MixTeamController.getOriginalParticipants);

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

module.exports = router; 