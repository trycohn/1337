const TournamentService = require('../../services/tournament/TournamentService');
const TournamentResultsService = require('../../services/tournament/TournamentResultsService_simple');
const ParticipantService = require('../../services/tournament/ParticipantService');
const BracketService = require('../../services/tournament/BracketService');
const ChatService = require('../../services/tournament/ChatService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { validateTournamentDescription, validateTournamentRules } = require('../../utils/htmlValidator');
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
        
        const tournament = await TournamentService.getTournamentDetails(tournamentId);
        
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
        
        res.json({ 
            message: 'Турнир успешно удален',
            success: true 
        });
    });

    // ✏️ Ручное редактирование сетки (критическое действие)
    static manualBracketEdit = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { bracketData } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }

        // 🔧 ВАЛИДАЦИЯ ДАННЫХ СЕТКИ
        if (!Array.isArray(bracketData) || bracketData.length === 0) {
            return res.status(400).json({ 
                message: 'Некорректные данные сетки',
                received_data: bracketData
            });
        }

        console.log(`✏️ [manualBracketEdit] Ручное редактирование сетки турнира ${tournamentId}`);
        console.log(`📊 [manualBracketEdit] Получено ${bracketData.length} изменений матчей`);

        const result = await TournamentService.manualBracketEdit(
            tournamentId, 
            bracketData, 
            req.user.id
        );
        
        res.json({
            message: 'Расстановка участников успешно обновлена',
            success: true,
            updatedMatches: result.updatedMatches,
            clearedResults: result.clearedResults
        });
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
        
        // 🛡️ ВАЛИДАЦИЯ HTML БЕЗОПАСНОСТИ
        if (description) {
            const validation = validateTournamentDescription(description);
            if (!validation.isValid) {
                return res.status(400).json({
                    error: 'Описание не прошло проверку безопасности',
                    details: validation.errors
                });
            }
            
            // Логируем предупреждения
            if (validation.warnings && validation.warnings.length > 0) {
                console.warn(`⚠️ Предупреждения при валидации описания турнира ${tournamentId}:`, validation.warnings);
            }
            
            // Используем санитизированную версию
            req.body.description = validation.sanitizedContent;
        }
        
        const tournament = await TournamentService.updateDescription(
            tournamentId, 
            req.body.description, 
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
        
        // 🛡️ ВАЛИДАЦИЯ HTML БЕЗОПАСНОСТИ
        if (rules) {
            const validation = validateTournamentRules(rules);
            if (!validation.isValid) {
                return res.status(400).json({
                    error: 'Регламент не прошел проверку безопасности',
                    details: validation.errors
                });
            }
            
            // Логируем предупреждения
            if (validation.warnings && validation.warnings.length > 0) {
                console.warn(`⚠️ Предупреждения при валидации регламента турнира ${tournamentId}:`, validation.warnings);
            }
            
            // Используем санитизированную версию
            req.body.rules = validation.sanitizedContent;
        }
        
        const tournament = await TournamentService.updateRules(
            tournamentId, 
            req.body.rules, 
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

    // 🎮 Обновление дисциплины турнира
    static updateGame = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { game } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ ИГРЫ
        if (!game || typeof game !== 'string' || game.trim().length === 0) {
            return res.status(400).json({ 
                message: 'Дисциплина не может быть пустой',
                received_game: game
            });
        }
        
        console.log(`🎮 [updateGame] Обновление дисциплины турнира ${tournamentId} на "${game}"`);
        
        const tournament = await TournamentService.updateGame(
            tournamentId, 
            game.trim(), 
            req.user.id
        );
        
        res.json({
            message: `Дисциплина успешно изменена на: ${game}`,
            tournament,
            game: game
        });
    });

    // 🏆 Обновление формата турнира
    static updateFormat = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { format } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ ФОРМАТА
        const validFormats = ['single_elimination', 'double_elimination', 'mix'];
        if (!validFormats.includes(format)) {
            return res.status(400).json({ 
                message: 'Некорректный формат турнира',
                received_format: format,
                valid_formats: validFormats
            });
        }
        
        console.log(`🏆 [updateFormat] Обновление формата турнира ${tournamentId} на "${format}"`);
        
        const tournament = await TournamentService.updateFormat(
            tournamentId, 
            format, 
            req.user.id
        );
        
        const formatNames = {
            'single_elimination': 'Single Elimination',
            'double_elimination': 'Double Elimination',
            'mix': 'Микс-турнир'
        };
        
        res.json({
            message: `Формат успешно изменен на: ${formatNames[format]}`,
            tournament,
            format: format
        });
    });

    // 📅 Обновление даты старта турнира
    static updateStartDate = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { start_date } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ ДАТЫ
        if (!start_date) {
            return res.status(400).json({ 
                message: 'Дата старта не может быть пустой',
                received_date: start_date
            });
        }
        
        const startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) {
            return res.status(400).json({ 
                message: 'Некорректный формат даты',
                received_date: start_date
            });
        }
        
        console.log(`📅 [updateStartDate] Обновление даты старта турнира ${tournamentId} на "${start_date}"`);
        
        const tournament = await TournamentService.updateStartDate(
            tournamentId, 
            startDate, 
            req.user.id
        );
        
        res.json({
            message: `Дата старта успешно изменена на: ${startDate.toLocaleString('ru-RU')}`,
            tournament,
            start_date: startDate
        });
    });

    // 🎮 Обновление настроек лобби
    static updateLobbyEnabled = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { lobby_enabled } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ ЗНАЧЕНИЯ
        if (typeof lobby_enabled !== 'boolean') {
            return res.status(400).json({ 
                message: 'lobby_enabled должен быть булевым значением',
                received_value: lobby_enabled
            });
        }
        
        console.log(`🎮 [updateLobbyEnabled] Обновление настроек лобби турнира ${tournamentId} на "${lobby_enabled}"`);
        
        const tournament = await TournamentService.updateLobbyEnabled(
            tournamentId, 
            lobby_enabled, 
            req.user.id
        );
        
        res.json({
            message: `Настройки лобби успешно ${lobby_enabled ? 'включены' : 'выключены'}`,
            tournament,
            lobby_enabled: lobby_enabled
        });
    });

    // 🏆 Обновление типа турнирной сетки
    static updateBracketType = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 🔧 ВАЛИДАЦИЯ ID ТУРНИРА
        const tournamentId = parseInt(id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
            return res.status(400).json({ 
                message: 'ID турнира должен быть положительным числом',
                received_id: id
            });
        }
        
        const { bracket_type } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ ТИПА СЕТКИ
        const validBracketTypes = ['single_elimination', 'double_elimination'];
        if (!validBracketTypes.includes(bracket_type)) {
            return res.status(400).json({ 
                message: 'Некорректный тип турнирной сетки',
                received_bracket_type: bracket_type,
                valid_bracket_types: validBracketTypes
            });
        }
        
        console.log(`🏆 [updateBracketType] Обновление типа сетки турнира ${tournamentId} на "${bracket_type}"`);
        
        // 🔧 ПРОВЕРКА ПРАВ ДОСТУПА происходит в TournamentService._checkTournamentCreatorAccess
        const tournament = await TournamentService.updateBracketType(
            tournamentId, 
            bracket_type, 
            req.user.id
        );
        
        const bracketTypeNames = {
            'single_elimination': 'Single Elimination',
            'double_elimination': 'Double Elimination'
        };
        
        res.json({
            message: `Тип турнирной сетки успешно изменен на: ${bracketTypeNames[bracket_type]}`,
            tournament,
            bracket_type: bracket_type
        });
    });

    // 👥 Обновление размера команды для микс-турниров
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
        
        const { team_size } = req.body;
        
        // 🔧 ВАЛИДАЦИЯ РАЗМЕРА КОМАНДЫ
        const teamSize = parseInt(team_size, 10);
        if (isNaN(teamSize) || ![2, 3, 4, 5].includes(teamSize)) {
            return res.status(400).json({ 
                message: 'Размер команды должен быть 2, 3, 4 или 5',
                received_team_size: team_size
            });
        }
        
        console.log(`👥 [updateTeamSize] Обновление размера команды турнира ${tournamentId} на ${teamSize}`);
        
        const tournament = await TournamentService.updateTeamSize(
            tournamentId, 
            teamSize, 
            req.user.id
        );
        
        const sizeNames = {
            2: '2 игрока',
            3: '3 игрока',
            4: '4 игрока',
            5: '5 игроков'
        };
        
        let message = `Размер команды успешно изменен на: ${sizeNames[teamSize]}`;
        
        // Если были удалены команды, добавляем информацию об этом
        if (tournament.teams_deleted) {
            message += `. Существующие команды распущены, участники снова доступны для формирования новых команд.`;
        }
        
        res.json({
            message,
            tournament,
            team_size: teamSize
        });
    });

    // Получение победителей последних турниров
    static getWinners = asyncHandler(async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 5;

            // Получаем последние завершенные турниры с победителями
            const result = await TournamentService.getWinners(limit);

            res.json(result);
        } catch (error) {
            console.error('Ошибка при получении победителей:', error);
            res.status(500).json({ error: 'Ошибка при получении победителей' });
        }
    });

    // 📊 Получение результатов турнира с правильной статистикой
    static getTournamentResults = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        if (!id || isNaN(parseInt(id))) {
            return res.status(400).json({ error: 'Некорректный ID турнира' });
        }
        
        try {
            const results = await TournamentResultsService.getTournamentResults(parseInt(id));
            res.json(results);
        } catch (error) {
            console.error(`❌ Ошибка при получении результатов турнира ${id}:`, error);
            
            if (error.message.includes('не найден')) {
                return res.status(404).json({ error: error.message });
            }
            
            res.status(500).json({ error: 'Ошибка при получении результатов турнира' });
        }
    });
}

module.exports = TournamentController; 