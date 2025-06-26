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
const { authenticateToken } = require('../../middleware/auth');

const router = express.Router();

// 📋 **ОСНОВНЫЕ ТУРНИРНЫЕ ОПЕРАЦИИ**

// Получение всех турниров
router.get('/', TournamentController.getAllTournaments);

// Получение турнира по ID
router.get('/:id', TournamentController.getTournamentById);

// Создание нового турнира (требует авторизации)
router.post('/', authenticateToken, TournamentController.createTournament);

// Обновление турнира (требует авторизации)
router.put('/:id', authenticateToken, TournamentController.updateTournament);

// Удаление турнира (требует авторизации)
router.delete('/:id', authenticateToken, TournamentController.deleteTournament);

// Начало турнира (требует авторизации)
router.post('/:id/start', authenticateToken, TournamentController.startTournament);

// Получение списка игр
router.get('/games/list', TournamentController.getGames);

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

// 👥 **УПРАВЛЕНИЕ УЧАСТНИКАМИ**

// Участие в турнире
router.post('/:id/participate', authenticateToken, ParticipantController.participateInTournament);

// Отмена участия
router.delete('/:id/participate', authenticateToken, ParticipantController.cancelParticipation);

// Получение участников турнира
router.get('/:id/participants', ParticipantController.getParticipants);

// Удаление участника (для администраторов)
router.delete('/:id/participants/:participantId', authenticateToken, ParticipantController.removeParticipant);

// 🥊 **УПРАВЛЕНИЕ МАТЧАМИ И СЕТКАМИ**

// Генерация турнирной сетки
router.post('/:id/generate-bracket', authenticateToken, MatchController.generateBracket);

// Регенерация турнирной сетки
router.post('/:id/regenerate-bracket', authenticateToken, MatchController.regenerateBracket);

// Обновление результата матча
router.put('/:id/matches/:matchId/result', authenticateToken, MatchController.updateMatchResult);

// Получение матчей турнира
router.get('/:id/matches', MatchController.getMatches);

// 🛡️ **АДМИНИСТРАТИВНЫЕ ФУНКЦИИ**

// Запрос на администрирование
router.post('/:id/request-admin', authenticateToken, AdminController.requestAdmin);

// Ответ на запрос администрирования
router.post('/:id/respond-admin-request', authenticateToken, AdminController.respondToAdminRequest);

// Удаление администратора
router.delete('/:id/admins/:adminId', authenticateToken, AdminController.removeAdmin);

// 💬 **ЧАТ ТУРНИРА**

// Получение сообщений чата
router.get('/:id/chat/messages', authenticateToken, ChatController.getChatMessages);

// Получение участников чата
router.get('/:id/chat/participants', authenticateToken, ChatController.getChatParticipants);

// 🛠️ **ОБРАБОТКА ОШИБОК ТУРНИРОВ**
const { tournamentErrorHandler } = require('../../middleware/tournament/errorHandler');
router.use(tournamentErrorHandler);

module.exports = router; 