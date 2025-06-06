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

// Конвертация rank_tier в приблизительный MMR
function rankTierToMMR(rankTier) {
    if (!rankTier || rankTier === 0) return 0;
    
    // OpenDota rank_tier: десятки = ранг, единицы = звезды (1-5)
    const rankNumber = Math.floor(rankTier / 10); // 1-8 (Herald-Immortal)
    const stars = rankTier % 10; // 1-5
    
    // MMR диапазоны для каждого ранга (средние значения)
    const mmrRanges = {
        1: { // Herald
            1: 77,   // 0-153 MMR
            2: 231,  // 154-307 MMR
            3: 385,  // 308-461 MMR
            4: 539,  // 462-615 MMR
            5: 693   // 616-769 MMR
        },
        2: { // Guardian
            1: 847,  // 770-923 MMR
            2: 1001, // 924-1077 MMR
            3: 1155, // 1078-1231 MMR
            4: 1309, // 1232-1385 MMR
            5: 1463  // 1386-1539 MMR
        },
        3: { // Crusader
            1: 1617, // 1540-1693 MMR
            2: 1771, // 1694-1847 MMR
            3: 1925, // 1848-2001 MMR
            4: 2079, // 2002-2155 MMR
            5: 2233  // 2156-2309 MMR
        },
        4: { // Archon
            1: 2387, // 2310-2463 MMR
            2: 2541, // 2464-2617 MMR
            3: 2695, // 2618-2771 MMR
            4: 2849, // 2772-2925 MMR
            5: 3003  // 2926-3079 MMR
        },
        5: { // Legend
            1: 3157, // 3080-3233 MMR
            2: 3311, // 3234-3387 MMR
            3: 3465, // 3388-3541 MMR
            4: 3619, // 3542-3695 MMR
            5: 3773  // 3696-3849 MMR
        },
        6: { // Ancient
            1: 3927, // 3850-4003 MMR
            2: 4081, // 4004-4157 MMR
            3: 4235, // 4158-4311 MMR
            4: 4389, // 4312-4465 MMR
            5: 4543  // 4466-4619 MMR
        },
        7: { // Divine
            1: 4720, // 4620-4819 MMR
            2: 4920, // 4820-5019 MMR
            3: 5120, // 5020-5219 MMR
            4: 5320, // 5220-5419 MMR
            5: 5420  // 5420+ MMR
        },
        8: { // Immortal
            1: 5620, // 5620+ MMR
            2: 5720,
            3: 5820,
            4: 5920,
            5: 6020
        }
    };
    
    // Валидация входных данных
    if (rankNumber < 1 || rankNumber > 8 || stars < 1 || stars > 5) {
        console.warn(`Неверный rank_tier: ${rankTier}, rankNumber: ${rankNumber}, stars: ${stars}`);
        return 0;
    }
    
    return mmrRanges[rankNumber] && mmrRanges[rankNumber][stars] ? mmrRanges[rankNumber][stars] : 0;
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

        // Рассчитываем приблизительный MMR на основе rank_tier
        const estimatedMMR = rankTierToMMR(playerProfile.rank_tier);
        
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
                estimated_mmr: estimatedMMR,
                leaderboard_rank: playerProfile.leaderboard_rank,
                mmr_estimate: playerProfile.competitive_rank || playerProfile.solo_competitive_rank || estimatedMMR,
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
            estimated_mmr: profile.estimated_mmr,
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

// Массовое обновление MMR для существующих профилей
router.post('/profiles/update-mmr', async (req, res) => {
    try {
        console.log('🔄 Массовое обновление MMR для существующих профилей...');
        
        // Получаем все профили где есть rank_tier, но нет estimated_mmr
        const profiles = await pool.query(`
            SELECT id, dota_stats 
            FROM dota_profiles 
            WHERE estimated_mmr IS NULL OR estimated_mmr = 0
        `);
        
        let updatedCount = 0;
        
        for (const profile of profiles.rows) {
            try {
                const dotaStats = profile.dota_stats;
                
                if (dotaStats && dotaStats.profile && dotaStats.profile.rank_tier) {
                    const estimatedMMR = rankTierToMMR(dotaStats.profile.rank_tier);
                    
                    if (estimatedMMR > 0) {
                        await pool.query(
                            'UPDATE dota_profiles SET estimated_mmr = $1 WHERE id = $2',
                            [estimatedMMR, profile.id]
                        );
                        updatedCount++;
                        console.log(`✅ Обновлен профиль ID ${profile.id}: rank_tier ${dotaStats.profile.rank_tier} → ${estimatedMMR} MMR`);
                    }
                }
            } catch (err) {
                console.error(`❌ Ошибка обновления профиля ID ${profile.id}:`, err.message);
            }
        }
        
        console.log(`✅ Массовое обновление завершено. Обновлено профилей: ${updatedCount}`);
        res.json({ 
            message: 'Массовое обновление MMR завершено',
            updated_profiles: updatedCount,
            total_profiles: profiles.rows.length
        });
        
    } catch (error) {
        console.error('❌ Ошибка массового обновления MMR:', error.message);
        res.status(500).json({ 
            error: 'Ошибка массового обновления MMR',
            details: error.message 
        });
    }
});

module.exports = router;