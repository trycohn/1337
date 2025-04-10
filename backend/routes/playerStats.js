const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');

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

        await page.waitForSelector('#player-ranks', { timeout: 10000 });

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

router.get('/:steamId', async (req, res) => {
    try {
        const { steamId } = req.params;
        
        if (!steamId) {
            return res.status(400).json({ 
                success: false,
                error: 'Steam ID обязателен' 
            });
        }

        const stats = await scrapePlayerStats(steamId);
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Ошибка при получении статистики игрока:', error);
        res.status(500).json({
            success: false,
            error: 'Не удалось получить статистику игрока'
        });
    }
});

module.exports = router;