const TournamentService = require('../../services/tournament/TournamentService');
const ParticipantService = require('../../services/tournament/ParticipantService');
const BracketService = require('../../services/tournament/BracketService');
const ChatService = require('../../services/tournament/ChatService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { asyncHandler } = require('../../utils/asyncHandler');

class TournamentController {
    // 📋 Получение списка всех турниров
    static getAllTournaments = asyncHandler(async (req, res) => {
        const tournaments = await TournamentService.getAllTournaments();
        res.json(tournaments);
    });

    // 🎯 Получение конкретного турнира
    static getTournamentById = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        console.log(`🔍 [getTournamentById] Получен запрос с ID: "${id}", тип: ${typeof id}`);
        
        if (!id || id === 'undefined' || id === 'null') {
            console.log(`❌ [getTournamentById] Некорректный ID турнира: "${id}"`);
            return res.status(400).json({ 
                message: 'Некорректный ID турнира',
                received_id: id 
            });
        }
        
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            console.log(`❌ [getTournamentById] ID турнира не является положительным числом: "${id}" -> ${tournamentId}`);
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id,
                parsed_id: tournamentId
            });
        }
        
        console.log(`✅ [getTournamentById] Валидация пройдена, ищем турнир с ID: ${tournamentId}`);
        
        const tournament = await TournamentService.getTournamentById(tournamentId);
        
        if (!tournament) {
            console.log(`❌ [getTournamentById] Турнир с ID ${tournamentId} не найден`);
            return res.status(404).json({ message: 'Турнир не найден' });
        }
        
        console.log(`✅ [getTournamentById] Турнир ${tournamentId} найден: "${tournament.name}"`);
        res.json(tournament);
    });

    // ➕ Создание нового турнира
    static createTournament = asyncHandler(async (req, res) => {
        const validationResult = TournamentValidator.validateCreate(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        const tournament = await TournamentService.createTournament(req.body, req.user.id, req.user.username);
        
        res.status(201).json({
            message: 'Турнир успешно создан',
            tournament
        });
    });

    // 📖 Получение турнира
    static getTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const tournament = await TournamentService.getTournament(tournamentId);
        
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        res.json(tournament);
    });

    // 📋 Получение всех турниров
    static getTournaments = asyncHandler(async (req, res) => {
        const { page, limit, status, game, participant_type } = req.query;
        
        const filters = { status, game, participant_type };
        const tournaments = await TournamentService.getTournaments(filters, parseInt(page, 10), parseInt(limit, 10));
        
        res.json(tournaments);
    });

    // ✏️ Обновление турнира
    static updateTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const validationResult = TournamentValidator.validateUpdate(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        const tournament = await TournamentService.updateTournament(
            tournamentId, 
            req.body, 
            req.user.id
        );
        
        res.json({
            message: 'Турнир успешно обновлен',
            tournament
        });
    });

    // 🗑️ Удаление турнира
    static deleteTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        await TournamentService.deleteTournament(tournamentId, req.user.id);
        
        res.json({ message: 'Турнир успешно удален' });
    });

    // 🚀 Запуск турнира
    static startTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const result = await TournamentService.startTournament(tournamentId, req.user.id);
        
        res.json(result);
    });

    // 🏁 Завершение турнира
    static endTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const result = await TournamentService.endTournament(tournamentId, req.user.id);
        
        res.json(result);
    });

    // 🎮 Получение списка игр
    static getGames = asyncHandler(async (req, res) => {
        console.log('🎮 [TournamentController.getGames] Запрос получения списка игр');
        console.log('📊 [getGames] Request params:', req.params);
        console.log('📊 [getGames] Request query:', req.query);
        console.log('📊 [getGames] Request body:', req.body);
        
        try {
        const games = await TournamentService.getGames();
            console.log(`✅ [getGames] Успешно получено ${games.length} игр`);
        res.json(games);
        } catch (error) {
            console.error('❌ [getGames] Ошибка получения списка игр:', error);
            throw error; // asyncHandler обработает ошибку
        }
    });

    // 🥊 Генерация турнирной сетки
    static generateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { thirdPlaceMatch = false } = req.body;
        
        const result = await BracketService.generateBracket(
            tournamentId, 
            req.user.id, 
            thirdPlaceMatch
        );
        
        res.json(result);
    });

    // 🔄 Регенерация турнирной сетки
    static regenerateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { shuffle = false, thirdPlaceMatch = false } = req.body;
        
        const result = await BracketService.regenerateBracket(
            tournamentId, 
            req.user.id, 
            shuffle, 
            thirdPlaceMatch
        );
        
        res.json(result);
    });

    // 🧹 Очистка результатов матчей
    static clearMatchResults = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const result = await BracketService.clearMatchResults(tournamentId, req.user.id);
        
        res.json(result);
    });

    // 📋 Получение турнирной сетки
    static getBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const bracket = await BracketService.getBracket(tournamentId);
        
        res.json(bracket);
    });

    // 🔄 Валидация турнирной сетки
    static validateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const validation = await BracketService.validateTournamentBracket(tournamentId);
        
        res.json({
            message: 'Диагностика турнирной сетки завершена',
            tournamentId: tournamentId,
            validation
        });
    });

    // 🔧 Сброс результатов матчей
    static resetMatchResults = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const result = await TournamentService.resetMatchResults(tournamentId, req.user.id);
        
        res.json(result);
    });

    // 🔍 Получение оригинальных участников
    static getOriginalParticipants = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const participants = await ParticipantService.getOriginalParticipants(tournamentId);
        
        res.json(participants);
    });

    // 🏆 Получение команд турнира
    static getTeams = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const teams = await TournamentService.getTeams(tournamentId);
        
        res.json(teams);
    });

    // 📝 Обновление описания
    static updateDescription = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { description } = req.body;
        
        const tournament = await TournamentService.updateDescription(
            tournamentId, 
            description, 
            req.user.id
        );
        
        res.json({ 
            message: 'Описание успешно обновлено', 
            tournament 
        });
    });

    // 📜 Обновление полного описания
    static updateFullDescription = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { full_description } = req.body;
        
        const tournament = await TournamentService.updateFullDescription(
            tournamentId, 
            full_description, 
            req.user.id
        );
        
        res.json({ 
            message: 'Полное описание турнира успешно обновлено', 
            tournament 
        });
    });

    // ⚖️ Обновление регламента
    static updateRules = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { rules } = req.body;
        
        const tournament = await TournamentService.updateRules(
            tournamentId, 
            rules, 
            req.user.id
        );
        
        res.json({ 
            message: 'Регламент успешно обновлен', 
            tournament 
        });
    });

    // 💰 Обновление призового фонда
    static updatePrizePool = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { prize_pool } = req.body;
        
        const tournament = await TournamentService.updatePrizePool(
            tournamentId, 
            prize_pool, 
            req.user.id
        );
        
        res.json({ 
            message: 'Призовой фонд успешно обновлен', 
            tournament 
        });
    });

    // 📏 Обновление размера команды
    static updateTeamSize = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { teamSize } = req.body;
        
        const tournament = await TournamentService.updateTeamSize(
            tournamentId, 
            teamSize, 
            req.user.id
        );
        
        res.json({
            message: `Размер команды успешно обновлен до ${teamSize}`,
            tournament
        });
    });

    // 🎯 Обновление типа рейтинга для микс-турниров
    static updateRatingType = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { mix_rating_type } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ ТИПА РЕЙТИНГА
        const validRatingTypes = ['faceit', 'premier', 'mixed'];
        if (!validRatingTypes.includes(mix_rating_type)) {
            return res.status(400).json({ 
                message: 'Некорректный тип рейтинга',
                received_type: mix_rating_type,
                valid_types: validRatingTypes
            });
        }
        
        console.log(`🎯 [updateRatingType] Обновление типа рейтинга турнира ${tournamentId} на ${mix_rating_type}`);
        
        const tournament = await TournamentService.updateRatingType(
            tournamentId, 
            mix_rating_type, 
            req.user.id
        );
        
        const typeNames = {
            'faceit': 'FACEIT ELO',
            'premier': 'CS2 Premier Rank', 
            'mixed': 'Случайный микс'
        };
        
        res.json({
            message: `Тип рейтинга успешно изменен на: ${typeNames[mix_rating_type]}`,
            tournament,
            rating_type: mix_rating_type
        });
    });
}

module.exports = TournamentController; 