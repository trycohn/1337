const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

async function scrapePlayerStats(steamId) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

        await page.goto(`https://csstats.gg/player/${steamId}`, {
            waitUntil: 'networkidle2',
        });

        await page.waitForSelector('#player-ranks', { timeout: 5000 });

        const stats = await page.evaluate(() => {
            const rankImages = Array.from(document.getElementById('player-ranks').querySelectorAll('img'))
                .map(img => img.src);
            const rankWins = Array.from(document.getElementById('player-ranks').querySelectorAll('span'))
                .map(span => span.innerText);
            
            return {
                ranks: rankImages,
                wins: rankWins
            };
        });

        return stats;
    } finally {
        await browser.close();
    }
}

// Функция для извлечения ранга Premier
function extractPremierRank(stats) {
    if (!stats || !stats.ranks || !stats.wins) return 0;
    
    // Фильтруем ранги
    let filteredRanks = stats.ranks.filter(url => !url.includes('logo-cs2.png'));
    
    // Если есть картинка logo-csgo.png, отрезаем её и все, что после
    const csgoIdx = filteredRanks.findIndex(url => url.includes('logo-csgo.png'));
    if (csgoIdx !== -1) {
        filteredRanks = filteredRanks.slice(0, csgoIdx);
    }
    
    // Ищем последний ранг premier.png
    const lastPremierIndex = filteredRanks.findLastIndex(url => url.includes('premier.png'));
    
    // Если ранг не найден, возвращаем 0
    if (lastPremierIndex === -1) return 0;
    
    // Ищем соответствующее значение побед
    let winValues = Array.from(stats.wins);
    
    // Функция для проверки формата win (например, "12,361" или "---")
    const validWinFormat = (win) => /^(\d{1,3}(,\d{3})*|---)$/.test(win);
    
    // Функция для поиска первого валидного значения win
    const getValidWinValue = () => {
        for (let i = 0; i < winValues.length; i++) {
            if (validWinFormat(winValues[i])) {
                const val = winValues[i];
                winValues.splice(i, 1);
                return val;
            }
        }
        return '---';
    };
    
    // Получаем первое значение побед
    const win = getValidWinValue();
    
    // Если значение "---" или неверного формата, возвращаем 0
    if (win === '---') return 0;
    
    // Извлекаем число из формата "12,361" -> 12
    const match = win.match(/^(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    
    return 0;
}

router.get('/:steamId', authenticateToken, async (req, res) => {
    try {
        const { steamId } = req.params;
        
        if (!steamId) {
            return res.status(400).json({ 
                success: false,
                error: 'Steam ID обязателен' 
            });
        }

        const stats = await scrapePlayerStats(steamId);
        
        // Извлекаем ранг Premier
        const premierRank = extractPremierRank(stats);
        
        // Сохраняем ранг в базу данных, если пользователь аутентифицирован
        if (req.user && req.user.id) {
            await pool.query(
                'UPDATE users SET cs2_premier_rank = $1 WHERE id = $2',
                [premierRank, req.user.id]
            );
        }
        
        res.json({
            success: true,
            data: stats,
            premier_rank: premierRank
        });
    } catch (error) {
        console.error('Ошибка при получении статистики игрока:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить статистику игрока'
        });
    }
});

// Эндпоинт для получения только ранга Premier из базы данных
router.get('/premier-rank/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await pool.query(
            'SELECT cs2_premier_rank FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }
        
        res.json({
            success: true,
            premier_rank: result.rows[0].cs2_premier_rank || 0
        });
    } catch (error) {
        console.error('Ошибка при получении ранга Premier:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить ранг Premier'
        });
    }
});

module.exports = router;