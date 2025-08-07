const { asyncHandler } = require('../../utils/asyncHandler');
const MatchService = require('../../services/tournament/MatchService');
const TournamentService = require('../../services/tournament/TournamentService');
const fs = require('fs');
const path = require('path');

// Пытаемся импортировать canvas, если не установлен - используем SVG
let Canvas;
try {
    Canvas = require('canvas');
} catch (error) {
    console.log('⚠️ Canvas не установлен, используем SVG генерацию');
    Canvas = null;
}

/**
 * 🔗 ShareController - Контроллер для генерации контента для шейринга
 * Создает изображения для Open Graph превью в социальных сетях
 * 
 * @version 2.0
 * @features Генерация PNG (canvas) или SVG изображений, SEO оптимизация
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
            
            // Выбираем метод генерации в зависимости от доступности canvas
            let imageBuffer, contentType;
            
            if (Canvas) {
                // Используем canvas для PNG
                imageBuffer = await ShareController._createMatchImagePNG(match, tournament);
                contentType = 'image/png';
                console.log('✅ Изображение создано через Canvas (PNG)');
            } else {
                // Используем SVG как fallback
                imageBuffer = ShareController._createMatchSVG(match, tournament);
                contentType = 'image/svg+xml';
                console.log('✅ Изображение создано как SVG (fallback)');
            }
            
            // Устанавливаем заголовки для кеширования
            res.set({
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600', // Кеш на 1 час
                'ETag': `"match-${matchId}-${match.updated_at || match.created_at}"`
            });
            
            res.send(imageBuffer);
            
        } catch (error) {
            console.error(`❌ [ShareController] Ошибка генерации изображения:`, error.message);
            
            // Возвращаем заглушку при ошибке
            const placeholderData = Canvas 
                ? await ShareController._createPlaceholderImagePNG()
                : ShareController._createPlaceholderSVG();
            
            res.set({
                'Content-Type': Canvas ? 'image/png' : 'image/svg+xml',
                'Cache-Control': 'public, max-age=300' // Кеш заглушки на 5 минут
            });
            
            res.send(placeholderData);
        }
    });
    
    /**
     * 🎨 Создает PNG изображение для матча с помощью Canvas
     * @private
     */
    static async _createMatchImagePNG(match, tournament) {
        const { createCanvas, registerFont } = Canvas;
        
        const width = 1200;
        const height = 630;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Пытаемся загрузить кастомный шрифт (опционально)
        try {
            const fontPath = path.join(__dirname, '../../assets/fonts/Roboto-Bold.ttf');
            if (fs.existsSync(fontPath)) {
                registerFont(fontPath, { family: 'Roboto' });
            }
        } catch (error) {
            console.log('⚠️ Кастомный шрифт не загружен, используем системный');
        }
        
        // Фон с градиентом
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.5, '#111111');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Красная рамка
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, width - 8, height - 8);
        
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
        
        // Заголовок турнира
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px Roboto, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Обрезаем длинные названия турниров
        const tournamentName = tournament.name.length > 50 
            ? tournament.name.substring(0, 47) + '...'
            : tournament.name;
        ctx.fillText(tournamentName, width / 2, 80);
        
        // Номер матча
        ctx.fillStyle = '#cccccc';
        ctx.font = '28px Roboto, Arial, sans-serif';
        ctx.fillText(`Матч #${match.match_number || match.id}`, width / 2, 120);
        
        // Команда 1
        ctx.fillStyle = match.winner_team_id === match.team1_id ? '#ffd700' : '#ffffff';
        ctx.font = 'bold 48px Roboto, Arial, sans-serif';
        
        // Обрезаем длинные названия команд
        const team1Name = team1.length > 20 ? team1.substring(0, 17) + '...' : team1;
        ctx.fillText(team1Name, width / 4, 250);
        
        // VS
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 36px Roboto, Arial, sans-serif';
        ctx.fillText('VS', width / 2, 250);
        
        // Команда 2
        ctx.fillStyle = match.winner_team_id === match.team2_id ? '#ffd700' : '#ffffff';
        ctx.font = 'bold 48px Roboto, Arial, sans-serif';
        
        const team2Name = team2.length > 20 ? team2.substring(0, 17) + '...' : team2;
        ctx.fillText(team2Name, (width * 3) / 4, 250);
        
        // Счет
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 72px Roboto, Arial, sans-serif';
        ctx.fillText(score, width / 2, 350);
        
        // Победитель (если есть)
        if (match.winner_team_id) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 32px Roboto, Arial, sans-serif';
            const winnerText = winner.length > 30 ? winner.substring(0, 27) + '...' : winner;
            ctx.fillText(`🏆 Победитель: ${winnerText}`, width / 2, 420);
        }
        
        // Раунд
        const roundName = match.round_name || `Раунд ${match.round}`;
        ctx.fillStyle = '#999999';
        ctx.font = '24px Roboto, Arial, sans-serif';
        ctx.fillText(roundName, width / 2, 480);
        
        // Брендинг
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Roboto, Arial, sans-serif';
        ctx.fillText('1337 Community', width / 2, 560);
        
        // Дата
        if (match.match_date || match.created_at) {
            const date = new Date(match.match_date || match.created_at);
            const dateStr = date.toLocaleDateString('ru-RU');
            ctx.fillStyle = '#666666';
            ctx.font = '20px Roboto, Arial, sans-serif';
            ctx.fillText(dateStr, width / 2, 590);
        }
        
        return canvas.toBuffer('image/png');
    }
    
    /**
     * 🎨 Создает SVG изображение для матча (fallback)
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
        
        // Обрезаем длинные названия
        const tournamentName = tournament.name.length > 50 
            ? tournament.name.substring(0, 47) + '...'
            : tournament.name;
        const team1Name = team1.length > 20 ? team1.substring(0, 17) + '...' : team1;
        const team2Name = team2.length > 20 ? team2.substring(0, 17) + '...' : team2;
        const winnerName = winner.length > 30 ? winner.substring(0, 27) + '...' : winner;
        
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
        ${ShareController._escapeXML(tournamentName)}
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
        ${ShareController._escapeXML(team1Name)}
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
        ${ShareController._escapeXML(team2Name)}
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
        🏆 Победитель: ${ShareController._escapeXML(winnerName)}
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
     * 🚫 Создает PNG заглушку при ошибке
     * @private
     */
    static async _createPlaceholderImagePNG() {
        const { createCanvas } = Canvas;
        
        const width = 1200;
        const height = 630;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Темный фон
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, width, height);
        
        // Рамка
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, width - 4, height - 4);
        
        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('1337 Community', width / 2, height / 2 - 40);
        
        ctx.fillStyle = '#cccccc';
        ctx.font = '32px Arial';
        ctx.fillText('Результат матча', width / 2, height / 2 + 20);
        
        ctx.fillStyle = '#666666';
        ctx.font = '24px Arial';
        ctx.fillText('Загружается...', width / 2, height / 2 + 60);
        
        return canvas.toBuffer('image/png');
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