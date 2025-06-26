const MatchService = require('../../services/tournament/MatchService');
const BracketService = require('../../services/tournament/BracketService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { asyncHandler } = require('../../utils/asyncHandler');

class MatchController {
    // 🥊 Генерация турнирной сетки
    static generateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { thirdPlaceMatch } = req.body;
        
        const result = await BracketService.generateBracket(
            parseInt(id),
            req.user.id,
            thirdPlaceMatch
        );
        
        res.json({
            message: 'Сетка успешно сгенерирована',
            tournament: result.tournament
        });
    });

    // 🔄 Перегенерация турнирной сетки
    static regenerateBracket = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { thirdPlaceMatch } = req.body;
        
        const result = await BracketService.regenerateBracket(
            parseInt(id),
            req.user.id,
            thirdPlaceMatch
        );
        
        res.json({
            success: true,
            message: 'Турнирная сетка успешно перегенерирована',
            tournament: result.tournament
        });
    });

    // 🏆 Обновление результата матча в рамках турнира
    static updateMatchResult = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { matchId, winner_team_id, score1, score2, maps } = req.body;
        
        const validationResult = TournamentValidator.validateMatchResult(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        const result = await MatchService.updateMatchResult(
            parseInt(id), 
            { matchId, winner_team_id, score1, score2, maps }, 
            req.user.id
        );
        
        res.json(result);
    });

    // 🎯 Обновление результата конкретного матча (альтернативный endpoint)
    static updateSpecificMatchResult = asyncHandler(async (req, res) => {
        const { matchId } = req.params;
        const { winner_team_id, score1, score2, maps_data } = req.body;
        
        const validationResult = TournamentValidator.validateMatchResult(req.body);
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.errors });
        }
        
        const result = await MatchService.updateSpecificMatchResult(
            parseInt(matchId),
            { winner_team_id, score1, score2, maps_data },
            req.user.id
        );
        
        res.json(result);
    });

    // 📋 Получение матчей турнира
    static getMatches = asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const matches = await MatchService.getMatches(parseInt(id));
        
        res.json(matches);
    });

    // 🔍 Получение конкретного матча
    static getMatchById = asyncHandler(async (req, res) => {
        const { matchId } = req.params;
        
        const match = await MatchService.getMatchById(parseInt(matchId));
        
        if (!match) {
            return res.status(404).json({ error: 'Матч не найден' });
        }
        
        res.json(match);
    });
}

module.exports = MatchController; 