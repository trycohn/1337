const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db');

// Базовый URL OpenDota API
const OPENDOTA_API_BASE = 'https://api.opendota.com/api';

// OpenDota API Token (опционально, для повышения лимитов)
const OPENDOTA_API_TOKEN = process.env.OPENDOTA_API_TOKEN || null;

// Функция для выполнения запросов к OpenDota API
async function makeOpenDotaRequest(endpoint, params = {}, method = 'GET') {
    try {
        const url = `${OPENDOTA_API_BASE}${endpoint}`;
        const config = {
            method: method,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': '1337Community-DotaStats/3.0'
            },
            params: {}
        };

        // Добавляем API ключ если есть
        if (OPENDOTA_API_TOKEN) {
            config.params.api_key = OPENDOTA_API_TOKEN;
        }

        // Добавляем дополнительные параметры
        Object.assign(config.params, params);

        const response = await axios(url, config);
        return response.data;
    } catch (error) {
        console.error(`Ошибка запроса к OpenDota API (${endpoint}):`, error.message);
        
        if (error.response?.status === 429) {
            throw new Error('Превышен лимит запросов к OpenDota API. Попробуйте позже.');
        }
        
        if (error.response?.status === 404) {
            throw new Error('Игрок не найден или профиль приватный');
        }
        
        throw new Error(`Не удалось получить данные от OpenDota API: ${error.message}`);
    }
}

// Конвертация Steam ID64 в Account ID для OpenDota
function steamIdToAccountId(steamId64) {
    return String(BigInt(steamId64) - BigInt('76561197960265728'));
}

// Получение информации об игроке по Steam ID
router.get('/player/:steamid', async (req, res) => {
    const { steamid } = req.params;
    
    try {
        console.log(`🔍 Получение статистики игрока Steam ID: ${steamid} через OpenDota API`);
        
        // Конвертируем Steam ID в account ID
        const accountId = steamIdToAccountId(steamid);
        
        // Получаем основную информацию об игроке
        const [playerProfile, winLoss, recentMatches, playerHeroes] = await Promise.all([
            makeOpenDotaRequest(`/players/${accountId}`),
            makeOpenDotaRequest(`/players/${accountId}/wl`),
            makeOpenDotaRequest(`/players/${accountId}/recentMatches`),
            makeOpenDotaRequest(`/players/${accountId}/heroes`, { significant: 1 })
        ]);

        if (!playerProfile || playerProfile.profile === null) {
            return res.status(404).json({ 
                error: 'Игрок не найден в OpenDota API',
                details: 'Возможно, профиль приватный или игрок не играл в Dota 2'
            });
        }

        // Получаем дополнительную статистику
        let rankings = [];
        try {
            rankings = await makeOpenDotaRequest(`/players/${accountId}/rankings`);
        } catch (error) {
            console.log('Не удалось получить рейтинги игрока:', error.message);
        }

        // Формируем ответ в формате, совместимом с фронтендом
        const result = {
            profile: {
                account_id: parseInt(accountId),
                steam_id: steamid,
                avatar: playerProfile.profile?.avatar,
                avatarmedium: playerProfile.profile?.avatarmedium,
                avatarfull: playerProfile.profile?.avatarfull,
                personaname: playerProfile.profile?.personaname,
                profileurl: playerProfile.profile?.profileurl,
                country_code: playerProfile.profile?.loccountrycode,
                rank_tier: playerProfile.rank_tier,
                leaderboard_rank: playerProfile.leaderboard_rank,
                mmr_estimate: playerProfile.competitive_rank || playerProfile.solo_competitive_rank,
                solo_competitive_rank: playerProfile.solo_competitive_rank,
                competitive_rank: playerProfile.competitive_rank,
                last_login: playerProfile.profile?.last_login,
                is_contributor: playerProfile.profile?.is_contributor,
                is_subscriber: playerProfile.profile?.is_subscriber,
                plus: playerProfile.profile?.plus
            },
            stats: {
                win: winLoss.win || 0,
                lose: winLoss.lose || 0,
                total_matches: (winLoss.win || 0) + (winLoss.lose || 0),
                winrate: (winLoss.win || 0) + (winLoss.lose || 0) > 0 ? 
                    (((winLoss.win || 0) / ((winLoss.win || 0) + (winLoss.lose || 0))) * 100).toFixed(2) : 0
            },
            recent_matches: (recentMatches || []).slice(0, 10).map(match => ({
                match_id: match.match_id,
                hero_id: match.hero_id,
                start_time: match.start_time,
                duration: match.duration,
                game_mode: match.game_mode,
                lobby_type: match.lobby_type,
                kills: match.kills,
                deaths: match.deaths,
                assists: match.assists,
                gold_per_min: match.gold_per_min,
                xp_per_min: match.xp_per_min,
                hero_damage: match.hero_damage,
                hero_healing: match.hero_healing,
                last_hits: match.last_hits,
                player_slot: match.player_slot,
                radiant_win: match.radiant_win,
                win: ((match.player_slot < 128) === match.radiant_win) ? 1 : 0,
                lane: match.lane,
                lane_role: match.lane_role,
                is_roaming: match.is_roaming,
                cluster: match.cluster,
                leaver_status: match.leaver_status,
                party_size: match.party_size
            })),
            top_heroes: (playerHeroes || [])
                .sort((a, b) => b.games - a.games)
                .slice(0, 10)
                .map(hero => ({
                    hero_id: hero.hero_id,
                    games: hero.games,
                    win: hero.win,
                    lose: hero.games - hero.win,
                    winrate: hero.games > 0 ? ((hero.win / hero.games) * 100).toFixed(2) : 0,
                    last_played: hero.last_played
                })),
            rankings: rankings || []
        };
        
        console.log(`✅ Успешно получена статистика для игрока ${steamid}`);
        res.json(result);
        
    } catch (error) {
        console.error(`❌ Ошибка при получении статистики игрока ${steamid}:`, error.message);
        res.status(500).json({ 
            error: 'Ошибка получения статистики игрока',
            details: error.message 
        });
    }
});

// Получение детальной информации о матче
router.get('/match/:matchid', async (req, res) => {
    const { matchid } = req.params;
    
    try {
        console.log(`🔍 Получение информации о матче ${matchid} через OpenDota API`);
        
        const matchData = await makeOpenDotaRequest(`/matches/${matchid}`);
        
        if (!matchData) {
            return res.status(404).json({ 
                error: 'Матч не найден',
                details: 'Матч не существует или еще не обработан'
            });
        }
        
        console.log(`✅ Успешно получена информация о матче ${matchid}`);
        res.json(matchData);
        
    } catch (error) {
        console.error(`❌ Ошибка при получении информации о матче ${matchid}:`, error.message);
        res.status(500).json({ 
            error: 'Ошибка получения информации о матче',
            details: error.message 
        });
    }
});

// Получение списка героев
router.get('/heroes', async (req, res) => {
    try {
        console.log('🔍 Получение списка героев через OpenDota API');
        
        const heroes = await makeOpenDotaRequest('/heroes');
        
        console.log(`✅ Успешно получен список героев (${heroes.length} героев)`);
        res.json(heroes);
        
    } catch (error) {
        console.error('❌ Ошибка при получении списка героев:', error.message);
        res.status(500).json({ 
            error: 'Ошибка получения списка героев',
            details: error.message 
        });
    }
});

// Получение статистики героев
router.get('/hero-stats', async (req, res) => {
    try {
        console.log('🔍 Получение статистики героев через OpenDota API');
        
        const heroStats = await makeOpenDotaRequest('/heroStats');
        
        console.log(`✅ Успешно получена статистика героев (${heroStats.length} героев)`);
        res.json(heroStats);
        
    } catch (error) {
        console.error('❌ Ошибка при получении статистики героев:', error.message);
        res.status(500).json({ 
            error: 'Ошибка получения статистики героев',
            details: error.message 
        });
    }
});

// Получение константы (например, героев, предметов и т.д.)
router.get('/constants/:resource', async (req, res) => {
    const { resource } = req.params;
    
    try {
        console.log(`🔍 Получение константы ${resource} через OpenDota API`);
        
        const constants = await makeOpenDotaRequest(`/constants/${resource}`);
        
        console.log(`✅ Успешно получена константа ${resource}`);
        res.json(constants);
        
    } catch (error) {
        console.error(`❌ Ошибка при получении константы ${resource}:`, error.message);
        res.status(500).json({ 
            error: `Ошибка получения константы ${resource}`,
            details: error.message 
        });
    }
});

// Поиск игроков
router.get('/search', async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.length < 3) {
        return res.status(400).json({ 
            error: 'Поисковый запрос должен содержать минимум 3 символа' 
        });
    }
    
    try {
        console.log(`🔍 Поиск игроков: "${q}" через OpenDota API`);
        
        const searchResults = await makeOpenDotaRequest('/search', { q });
        
        console.log(`✅ Найдено ${searchResults.length} игроков`);
        res.json(searchResults);
        
    } catch (error) {
        console.error(`❌ Ошибка при поиске игроков:`, error.message);
        res.status(500).json({ 
            error: 'Ошибка поиска игроков',
            details: error.message 
        });
    }
});

// Получение рейтингов игроков по герою
router.get('/rankings/:heroId', async (req, res) => {
    const { heroId } = req.params;
    
    try {
        console.log(`🔍 Получение рейтингов для героя ${heroId} через OpenDota API`);
        
        const rankings = await makeOpenDotaRequest('/rankings', { hero_id: heroId });
        
        console.log(`✅ Успешно получены рейтинги для героя ${heroId}`);
        res.json(rankings);
        
    } catch (error) {
        console.error(`❌ Ошибка при получении рейтингов для героя ${heroId}:`, error.message);
        res.status(500).json({ 
            error: 'Ошибка получения рейтингов',
            details: error.message 
        });
    }
});

// Получение данных о производительности героя
router.get('/benchmarks/:heroId', async (req, res) => {
    const { heroId } = req.params;
    
    try {
        console.log(`🔍 Получение бенчмарков для героя ${heroId} через OpenDota API`);
        
        const benchmarks = await makeOpenDotaRequest('/benchmarks', { hero_id: heroId });
        
        console.log(`✅ Успешно получены бенчмарки для героя ${heroId}`);
        res.json(benchmarks);
        
    } catch (error) {
        console.error(`❌ Ошибка при получении бенчмарков для героя ${heroId}:`, error.message);
        res.status(500).json({ 
            error: 'Ошибка получения бенчмарков',
            details: error.message 
        });
    }
});

// Сохранение профиля игрока в базу данных
router.post('/profile/save', async (req, res) => {
    const { user_id, steam_id, dota_stats } = req.body;
    
    if (!user_id || !steam_id || !dota_stats) {
        return res.status(400).json({ 
            error: 'Недостаточно данных для сохранения профиля' 
        });
    }
    
    try {
        const query = `
            INSERT INTO dota_profiles (user_id, steam_id, dota_stats, updated_at) 
            VALUES ($1, $2, $3, NOW()) 
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                steam_id = EXCLUDED.steam_id,
                dota_stats = EXCLUDED.dota_stats,
                updated_at = NOW()
        `;
        
        await pool.query(query, [user_id, steam_id, JSON.stringify(dota_stats)]);
        
        console.log(`✅ Профиль Dota 2 сохранен для пользователя ${user_id}`);
        res.json({ message: 'Профиль Dota 2 успешно сохранен' });
        
    } catch (error) {
        console.error('❌ Ошибка при сохранении профиля Dota 2:', error.message);
        res.status(500).json({ 
            error: 'Ошибка сохранения профиля',
            details: error.message 
        });
    }
});

// Получение сохраненного профиля игрока
router.get('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const query = 'SELECT * FROM dota_profiles WHERE user_id = $1';
        const result = await pool.query(query, [userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Профиль Dota 2 не найден' 
            });
        }
        
        const profile = result.rows[0];
        res.json({
            user_id: profile.user_id,
            steam_id: profile.steam_id,
            dota_stats: profile.dota_stats,
            created_at: profile.created_at,
            updated_at: profile.updated_at
        });
        
    } catch (error) {
        console.error('❌ Ошибка при получении профиля Dota 2:', error.message);
        res.status(500).json({ 
            error: 'Ошибка получения профиля',
            details: error.message 
        });
    }
});

// Удаление профиля игрока
router.delete('/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const query = 'DELETE FROM dota_profiles WHERE user_id = $1';
        const result = await pool.query(query, [userId]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ 
                error: 'Профиль Dota 2 не найден' 
            });
        }
        
        console.log(`✅ Профиль Dota 2 удален для пользователя ${userId}`);
        res.json({ message: 'Профиль Dota 2 успешно удален' });
        
    } catch (error) {
        console.error('❌ Ошибка при удалении профиля Dota 2:', error.message);
        res.status(500).json({ 
            error: 'Ошибка удаления профиля',
            details: error.message 
        });
    }
});

// Получение обновлений игрока (рефреш данных)
router.post('/player/:steamid/refresh', async (req, res) => {
    const { steamid } = req.params;
    
    try {
        console.log(`🔄 Запрос обновления данных игрока ${steamid}`);
        
        const accountId = steamIdToAccountId(steamid);
        const refreshResult = await makeOpenDotaRequest(`/players/${accountId}/refresh`, {}, 'POST');
        
        console.log(`✅ Данные игрока ${steamid} поставлены в очередь на обновление`);
        res.json({ 
            message: 'Данные поставлены в очередь на обновление',
            ...refreshResult 
        });
        
    } catch (error) {
        console.error(`❌ Ошибка при запросе обновления данных игрока ${steamid}:`, error.message);
        res.status(500).json({ 
            error: 'Ошибка запроса обновления',
            details: error.message 
        });
    }
});

module.exports = router; 