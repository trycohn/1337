const MatchService = require('../../services/tournament/MatchService');
const BracketService = require('../../services/tournament/BracketService');
const TournamentValidator = require('../../validators/tournament/TournamentValidator');
const { asyncHandler } = require('../../utils/asyncHandler');

class MatchController {
    // 🥊 Генерация турнирной сетки
    static generateBracket = asyncHandler(async (req, res) => {
        console.log('🚀 [MatchController.generateBracket] МОДУЛЬНЫЙ РОУТЕР ПОЛУЧИЛ ЗАПРОС!');
        console.log('🚀 [MatchController.generateBracket] Tournament ID:', req.params.id);
        console.log('🚀 [MatchController.generateBracket] User ID:', req.user.id);
        console.log('🚀 [MatchController.generateBracket] Request body:', req.body);
        
        const { id } = req.params;
        const { thirdPlaceMatch } = req.body;
        
        console.log('🚀 [MatchController.generateBracket] Вызываем BracketService.generateBracket...');
        
        const result = await BracketService.generateBracket(
            parseInt(id),
            req.user.id,
            thirdPlaceMatch
        );
        
        console.log('🚀 [MatchController.generateBracket] BracketService завершился успешно');
        
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
        
        // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ
        console.log(`🎯 [updateSpecificMatchResult] НАЧАЛО ОБРАБОТКИ ЗАПРОСА:`);
        console.log(`   - Match ID (params): ${matchId}`);
        console.log(`   - User ID: ${req.user.id}`);
        console.log(`   - Username: ${req.user.username}`);
        console.log(`   - Request Body:`, JSON.stringify(req.body, null, 2));
        console.log(`   - Winner Team ID: ${winner_team_id}`);
        console.log(`   - Score1: ${score1}`);
        console.log(`   - Score2: ${score2}`);
        console.log(`   - Maps data:`, maps_data);
        
        // 🔍 ВАЛИДАЦИЯ С ДЕТАЛЬНЫМ ЛОГИРОВАНИЕМ
        console.log(`📝 [updateSpecificMatchResult] Запускаем валидацию с данными:`, {
            winner_team_id,
            score1, 
            score2,
            maps_data,
            matchId
        });
        
        const validationResult = TournamentValidator.validateMatchResult(req.body);
        
        console.log(`📝 [updateSpecificMatchResult] Результат валидации:`, {
            isValid: validationResult.isValid,
            errors: validationResult.errors
        });
        
        if (!validationResult.isValid) {
            console.log(`❌ [updateSpecificMatchResult] ВАЛИДАЦИЯ НЕ ПРОШЛА:`);
            validationResult.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
            return res.status(400).json({ 
                error: 'Ошибка валидации данных',
                message: validationResult.errors 
            });
        }
        
        console.log(`✅ [updateSpecificMatchResult] Валидация прошла успешно, вызываем MatchService...`);
        
        try {
            const result = await MatchService.updateSpecificMatchResult(
                parseInt(matchId),
                { winner_team_id, score1, score2, maps_data },
                req.user.id
            );
            
            console.log(`🎉 [updateSpecificMatchResult] УСПЕШНОЕ ЗАВЕРШЕНИЕ`);
            res.json(result);
        } catch (serviceError) {
            console.error(`❌ [updateSpecificMatchResult] ОШИБКА В СЕРВИСЕ:`, serviceError.message);
            console.error(`❌ [updateSpecificMatchResult] Stack trace:`, serviceError.stack);
            throw serviceError; // Re-throw для asyncHandler
        }
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