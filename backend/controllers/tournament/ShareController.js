const asyncHandler = require('../../utils/asyncHandler');
const MatchService = require('../../services/tournament/MatchService');
const TournamentService = require('../../services/tournament/TournamentService');
const fs = require('fs');
const path = require('path');

/**
 * 🔗 ShareController - Контроллер для генерации контента для шейринга
 * Создает изображения для Open Graph превью в социальных сетях
 * 
 * @version 1.0
 * @features Генерация изображений матчей, SEO оптимизация
 */
class ShareController {
    
    /**
     * 🖼️ Генерирует изображение превью для матча
     * GET /api/tournaments/:id/match/:matchId/share-image
     */
    static generateMatchShareImage = asyncHandler(async (req, res) => {
        const { id: tournamentId, matchId } = req.params;
        
        console.log(`🖼️ [ShareController] Генерация изображения для матча ${matchId} турнира ${tournamentId}`);
        
        try {
            // Получаем данные матча и турнира
            const [match, tournament] = await Promise.all([
                MatchService.getById(parseInt(matchId)),
                TournamentService.getTournamentById(parseInt(tournamentId))
            ]);
            
            if (!match) {
                return res.status(404).json({
                    success: false,
                    message: 'Матч не найден'
                });
            }
            
            if (!tournament) {
                return res.status(404).json({
                    success: false,
                    message: 'Турнир не найден'
                });
            }
            
            // Возвращаем SVG изображение (временное решение)
            const svgContent = ShareController._createMatchSVG(match, tournament);
            
            // Устанавливаем заголовки для кеширования
            res.set({
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=3600', // Кеш на 1 час
                'ETag': `"match-${matchId}-${match.updated_at || match.created_at}"`
            });
            
            res.send(svgContent);
            
        } catch (error) {
            console.error(`❌ [ShareController] Ошибка генерации изображения:`, error.message);
            
            // Возвращаем заглушку при ошибке
            const placeholderSVG = ShareController._createPlaceholderSVG();
            
            res.set({
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=300' // Кеш заглушки на 5 минут
            });
            
            res.send(placeholderSVG);
        }
    });
    
    /**
     * 🎨 Создает SVG изображение для матча
     * @private
     */
    static _createMatchSVG(match, tournament) {
        const width = 1200;
        const height = 630;
        
        // Определяем команды и счет
        const team1 = match.team1_name || 'Команда 1';
        const team2 = match.team2_name || 'Команда 2';
        const winner = match.winner_team_id === match.team1_id ? team1 : team2;
        
        // Формируем счет
        let score = `${match.score1 || 0}:${match.score2 || 0}`;
        if (match.maps_data && Array.isArray(match.maps_data) && match.maps_data.length === 1) {
            const mapData = match.maps_data[0];
            if (mapData.team1_score !== undefined && mapData.team2_score !== undefined) {
                score = match.winner_team_id === match.team1_id 
                    ? `${mapData.team1_score}:${mapData.team2_score}`
                    : `${mapData.team2_score}:${mapData.team1_score}`;
            }
        }
        
        const roundName = match.round_name || `Раунд ${match.round}`;
        const dateStr = match.match_date || match.created_at 
            ? new Date(match.match_date || match.created_at).toLocaleDateString('ru-RU')
            : '';
        
        return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Фон с градиентом -->
    <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#111111;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
        </linearGradient>
    </defs>
    
    <!-- Фон -->
    <rect width="${width}" height="${height}" fill="url(#bgGradient)" />
    
    <!-- Красная рамка -->
    <rect x="4" y="4" width="${width - 8}" height="${height - 8}" 
          fill="none" stroke="#ff0000" stroke-width="8" />
    
    <!-- Заголовок турнира -->
    <text x="${width / 2}" y="80" text-anchor="middle" 
          fill="#ffffff" font-size="36" font-weight="bold" font-family="Arial">
        ${ShareController._escapeXML(tournament.name)}
    </text>
    
    <!-- Номер матча -->
    <text x="${width / 2}" y="120" text-anchor="middle" 
          fill="#cccccc" font-size="28" font-family="Arial">
        Матч #${match.match_number || match.id}
    </text>
    
    <!-- Команда 1 -->
    <text x="${width / 4}" y="250" text-anchor="middle" 
          fill="${match.winner_team_id === match.team1_id ? '#ffd700' : '#ffffff'}" 
          font-size="48" font-weight="bold" font-family="Arial">
        ${ShareController._escapeXML(team1)}
    </text>
    
    <!-- VS -->
    <text x="${width / 2}" y="250" text-anchor="middle" 
          fill="#ff0000" font-size="36" font-weight="bold" font-family="Arial">
        VS
    </text>
    
    <!-- Команда 2 -->
    <text x="${(width * 3) / 4}" y="250" text-anchor="middle" 
          fill="${match.winner_team_id === match.team2_id ? '#ffd700' : '#ffffff'}" 
          font-size="48" font-weight="bold" font-family="Arial">
        ${ShareController._escapeXML(team2)}
    </text>
    
    <!-- Счет -->
    <text x="${width / 2}" y="350" text-anchor="middle" 
          fill="#ff0000" font-size="72" font-weight="bold" font-family="Arial">
        ${score}
    </text>
    
    ${match.winner_team_id ? `
    <!-- Победитель -->
    <text x="${width / 2}" y="420" text-anchor="middle" 
          fill="#ffd700" font-size="32" font-weight="bold" font-family="Arial">
        🏆 Победитель: ${ShareController._escapeXML(winner)}
    </text>
    ` : ''}
    
    <!-- Раунд -->
    <text x="${width / 2}" y="480" text-anchor="middle" 
          fill="#999999" font-size="24" font-family="Arial">
        ${ShareController._escapeXML(roundName)}
    </text>
    
    <!-- Брендинг -->
    <text x="${width / 2}" y="560" text-anchor="middle" 
          fill="#ffffff" font-size="28" font-weight="bold" font-family="Arial">
        1337 Community
    </text>
    
    ${dateStr ? `
    <!-- Дата -->
    <text x="${width / 2}" y="590" text-anchor="middle" 
          fill="#666666" font-size="20" font-family="Arial">
        ${dateStr}
    </text>
    ` : ''}
</svg>`.trim();
    }
    
    /**
     * 🚫 Создает SVG заглушку при ошибке
     * @private
     */
    static _createPlaceholderSVG() {
        const width = 1200;
        const height = 630;
        
        return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Темный фон -->
    <rect width="${width}" height="${height}" fill="#111111" />
    
    <!-- Рамка -->
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" 
          fill="none" stroke="#333333" stroke-width="4" />
    
    <!-- Заголовок -->
    <text x="${width / 2}" y="${height / 2 - 40}" text-anchor="middle" 
          fill="#ffffff" font-size="48" font-weight="bold" font-family="Arial">
        1337 Community
    </text>
    
    <!-- Подзаголовок -->
    <text x="${width / 2}" y="${height / 2 + 20}" text-anchor="middle" 
          fill="#cccccc" font-size="32" font-family="Arial">
        Результат матча
    </text>
    
    <!-- Статус -->
    <text x="${width / 2}" y="${height / 2 + 60}" text-anchor="middle" 
          fill="#666666" font-size="24" font-family="Arial">
        Загружается...
    </text>
</svg>`.trim();
    }
    
    /**
     * 🛡️ Экранирует XML символы
     * @private
     */
    static _escapeXML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

module.exports = ShareController;