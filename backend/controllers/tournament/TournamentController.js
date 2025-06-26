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
        const tournament = await TournamentService.getTournamentById(parseInt(id));
        
        if (!tournament) {
            return res.status(404).json({ message: 'Турнир не найден' });
        }
        
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
        
        const tournament = await TournamentService.getTournament(parseInt(id));
        
        if (!tournament) {
            return res.status(404).json({ error: 'Турнир не найден' });
        }
        
        res.json(tournament);
    });

    // 📋 Получение всех турниров
    static getTournaments = asyncHandler(async (req, res) => {
        const { page, limit, status, game, participant_type } = req.query;
        
        const filters = { status, game, participant_type };
        const tournaments = await TournamentService.getTournaments(filters, parseInt(page), parseInt(limit));
        
        res.json(tournaments);
    });

    // ✏️ Обновление турнира
    static updateTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const validationResult = TournamentValidator.validateUpdate(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        const tournament = await TournamentService.updateTournament(
            parseInt(id), 
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
        
        await TournamentService.deleteTournament(parseInt(id), req.user.id);
        
        res.json({ message: 'Турнир успешно удален' });
    });

    // 🚀 Запуск турнира
    static startTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const result = await TournamentService.startTournament(parseInt(id), req.user.id);
        
        res.json(result);
    });

    // 🏁 Завершение турнира
    static endTournament = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const result = await TournamentService.endTournament(parseInt(id), req.user.id);
        
        res.json(result);
    });

    // 🎮 Получение списка игр
    static getGames = asyncHandler(async (req, res) => {
        const games = await TournamentService.getGames();
        res.json(games);
    });

    // 🥊 Генерация турнирной сетки
    static generateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { thirdPlaceMatch = false } = req.body;
        
        const result = await BracketService.generateBracket(
            parseInt(id), 
            req.user.id, 
            thirdPlaceMatch
        );
        
        res.json(result);
    });

    // 🔄 Регенерация турнирной сетки
    static regenerateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { shuffle = false, thirdPlaceMatch = false } = req.body;
        
        const result = await BracketService.regenerateBracket(
            parseInt(id), 
            req.user.id, 
            shuffle, 
            thirdPlaceMatch
        );
        
        res.json(result);
    });

    // 🧹 Очистка результатов матчей
    static clearMatchResults = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const result = await BracketService.clearMatchResults(parseInt(id), req.user.id);
        
        res.json(result);
    });

    // 📋 Получение турнирной сетки
    static getBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const bracket = await BracketService.getBracket(parseInt(id));
        
        res.json(bracket);
    });

    // 🔄 Валидация турнирной сетки
    static validateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const validation = await BracketService.validateTournamentBracket(parseInt(id));
        
        res.json({
            message: 'Диагностика турнирной сетки завершена',
            tournamentId: parseInt(id),
            validation
        });
    });

    // 🔧 Сброс результатов матчей
    static resetMatchResults = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await TournamentService.resetMatchResults(parseInt(id), req.user.id);
        
        res.json(result);
    });

    // 🔍 Получение оригинальных участников
    static getOriginalParticipants = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const participants = await ParticipantService.getOriginalParticipants(parseInt(id));
        
        res.json(participants);
    });

    // 🏆 Получение команд турнира
    static getTeams = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const teams = await TournamentService.getTeams(parseInt(id));
        
        res.json(teams);
    });

    // 📝 Обновление описания
    static updateDescription = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { description } = req.body;
        
        const tournament = await TournamentService.updateDescription(
            parseInt(id), 
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
        const { full_description } = req.body;
        
        const tournament = await TournamentService.updateFullDescription(
            parseInt(id), 
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
        const { rules } = req.body;
        
        const tournament = await TournamentService.updateRules(
            parseInt(id), 
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
        const { prize_pool } = req.body;
        
        const tournament = await TournamentService.updatePrizePool(
            parseInt(id), 
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
        const { teamSize } = req.body;
        
        const tournament = await TournamentService.updateTeamSize(
            parseInt(id), 
            teamSize, 
            req.user.id
        );
        
        res.json({
            message: `Размер команды успешно обновлен до ${teamSize}`,
            tournament
        });
    });
}

module.exports = TournamentController; 