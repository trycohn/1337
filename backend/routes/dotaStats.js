const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db');

// Базовый URL OpenDota API
const OPENDOTA_API_BASE = 'https://api.opendota.com/api';

// Функция для выполнения запросов к OpenDota API с обработкой ошибок
async function makeOpenDotaRequest(endpoint) {
    try {
        const response = await axios.get(`${OPENDOTA_API_BASE}${endpoint}`, {
            timeout: 10000,
            headers: {
                'User-Agent': '1337Community-DotaStats/1.0'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Ошибка запроса к OpenDota API ${endpoint}:`, error.message);
        throw new Error(`Не удалось получить данные от OpenDota API: ${error.message}`);
    }
}

// Получение информации об игроке по Steam ID
router.get('/player/:steamid', async (req, res) => {
    const { steamid } = req.params;
    
    try {
        // Конвертируем Steam ID в account ID (удаляем последние 32 бита)
        const accountId = BigInt(steamid) - BigInt('76561197960265728');
        
        console.log(`🔍 Получение статистики игрока Steam ID: ${steamid}, Account ID: ${accountId}`);
        
        // Получаем основную информацию об игроке
        const playerData = await makeOpenDotaRequest(`/players/${accountId}`);
        
        // Получаем последние матчи
        const recentMatches = await makeOpenDotaRequest(`/players/${accountId}/recentMatches`);
        
        // Получаем статистику по героям
        const heroStats = await makeOpenDotaRequest(`/players/${accountId}/heroes`);
        
        // Получаем общую статистику
        const playerStats = await makeOpenDotaRequest(`/players/${accountId}/wl`);
        
        // Получаем рейтинги
        const rankings = await makeOpenDotaRequest(`/players/${accountId}/rankings`);
        
        const result = {
            profile: {
                account_id: playerData.profile?.account_id,
                steam_id: steamid,
                avatar: playerData.profile?.avatar,
                avatarmedium: playerData.profile?.avatarmedium,
                avatarfull: playerData.profile?.avatarfull,
                personaname: playerData.profile?.personaname,
                profileurl: playerData.profile?.profileurl,
                last_login: playerData.profile?.last_login,
                plus: playerData.plus,
                mmr_estimate: playerData.mmr_estimate,
                rank_tier: playerData.rank_tier,
                leaderboard_rank: playerData.leaderboard_rank
            },
            stats: {
                win: playerStats.win || 0,
                lose: playerStats.lose || 0,
                winrate: playerStats.win && playerStats.lose ? 
                    ((playerStats.win / (playerStats.win + playerStats.lose)) * 100).toFixed(2) : 0
            },
            recent_matches: recentMatches.slice(0, 10).map(match => ({
                match_id: match.match_id,
                hero_id: match.hero_id,
                start_time: match.start_time,
                duration: match.duration,
                game_mode: match.game_mode,
                lobby_type: match.lobby_type,
                kills: match.kills,
                deaths: match.deaths,
                assists: match.assists,
                player_slot: match.player_slot,
                radiant_win: match.radiant_win,
                win: (match.player_slot < 128) === match.radiant_win
            })),
            top_heroes: heroStats.slice(0, 10).map(hero => ({
                hero_id: hero.hero_id,
                games: hero.games,
                win: hero.win,
                winrate: hero.games > 0 ? ((hero.win / hero.games) * 100).toFixed(2) : 0
            })),
            rankings: rankings.map(ranking => ({
                hero_id: ranking.hero_id,
                score: ranking.score,
                percent_rank: ranking.percent_rank,
                card: ranking.card
            }))
        };
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Ошибка получения статистики игрока:', error);
        res.status(500).json({ 
            error: 'Не удалось получить статистику игрока',
            details: error.message 
        });
    }
});

// Получение детальной информации о матче
router.get('/match/:matchid', async (req, res) => {
    const { matchid } = req.params;
    
    try {
        console.log(`🔍 Получение информации о матче: ${matchid}`);
        
        const matchData = await makeOpenDotaRequest(`/matches/${matchid}`);
        
        const result = {
            match_id: matchData.match_id,
            duration: matchData.duration,
            start_time: matchData.start_time,
            radiant_win: matchData.radiant_win,
            game_mode: matchData.game_mode,
            lobby_type: matchData.lobby_type,
            radiant_team: {
                score: matchData.radiant_score,
                tower_status: matchData.tower_status_radiant,
                barracks_status: matchData.barracks_status_radiant
            },
            dire_team: {
                score: matchData.dire_score,
                tower_status: matchData.tower_status_dire,
                barracks_status: matchData.barracks_status_dire
            },
            players: matchData.players.map(player => ({
                account_id: player.account_id,
                player_slot: player.player_slot,
                hero_id: player.hero_id,
                personaname: player.personaname,
                kills: player.kills,
                deaths: player.deaths,
                assists: player.assists,
                last_hits: player.last_hits,
                denies: player.denies,
                gold_per_min: player.gold_per_min,
                xp_per_min: player.xp_per_min,
                level: player.level,
                net_worth: player.net_worth,
                hero_damage: player.hero_damage,
                tower_damage: player.tower_damage,
                hero_healing: player.hero_healing,
                items: [
                    player.item_0,
                    player.item_1,
                    player.item_2,
                    player.item_3,
                    player.item_4,
                    player.item_5
                ],
                backpack: [
                    player.backpack_0,
                    player.backpack_1,
                    player.backpack_2
                ]
            }))
        };
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Ошибка получения информации о матче:', error);
        res.status(500).json({ 
            error: 'Не удалось получить информацию о матче',
            details: error.message 
        });
    }
});

// Поиск игрока по нику
router.get('/search/:query', async (req, res) => {
    const { query } = req.params;
    
    try {
        console.log(`🔍 Поиск игрока: ${query}`);
        
        const searchResults = await makeOpenDotaRequest(`/search?q=${encodeURIComponent(query)}`);
        
        const result = searchResults.slice(0, 20).map(player => ({
            account_id: player.account_id,
            avatar: player.avatar,
            avatarmedium: player.avatarmedium,
            personaname: player.personaname,
            last_match_time: player.last_match_time,
            similarity: player.similarity
        }));
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Ошибка поиска игрока:', error);
        res.status(500).json({ 
            error: 'Не удалось найти игрока',
            details: error.message 
        });
    }
});

// Получение статистики героев
router.get('/heroes', async (req, res) => {
    try {
        console.log('🔍 Получение статистики героев');
        
        const heroStats = await makeOpenDotaRequest('/heroStats');
        
        const result = heroStats.map(hero => ({
            hero_id: hero.id,
            name: hero.localized_name,
            primary_attr: hero.primary_attr,
            attack_type: hero.attack_type,
            roles: hero.roles,
            pro_pick: hero.pro_pick,
            pro_win: hero.pro_win,
            pro_ban: hero.pro_ban,
            pick_rate: hero.pro_pick > 0 ? ((hero.pro_pick / (hero.pro_pick + hero.pro_ban)) * 100).toFixed(2) : 0,
            win_rate: hero.pro_pick > 0 ? ((hero.pro_win / hero.pro_pick) * 100).toFixed(2) : 0
        }));
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Ошибка получения статистики героев:', error);
        res.status(500).json({ 
            error: 'Не удалось получить статистику героев',
            details: error.message 
        });
    }
});

// Получение последних профессиональных матчей
router.get('/pro-matches', async (req, res) => {
    try {
        console.log('🔍 Получение профессиональных матчей');
        
        const proMatches = await makeOpenDotaRequest('/proMatches');
        
        const result = proMatches.slice(0, 50).map(match => ({
            match_id: match.match_id,
            duration: match.duration,
            start_time: match.start_time,
            radiant_team_id: match.radiant_team_id,
            radiant_name: match.radiant_name,
            dire_team_id: match.dire_team_id,
            dire_name: match.dire_name,
            radiant_score: match.radiant_score,
            dire_score: match.dire_score,
            radiant_win: match.radiant_win,
            league_name: match.league_name
        }));
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Ошибка получения профессиональных матчей:', error);
        res.status(500).json({ 
            error: 'Не удалось получить профессиональные матчи',
            details: error.message 
        });
    }
});

// Получение общей статистики распределения рангов
router.get('/distributions', async (req, res) => {
    try {
        console.log('🔍 Получение распределения рангов');
        
        const distributions = await makeOpenDotaRequest('/distributions');
        
        res.json(distributions);
        
    } catch (error) {
        console.error('❌ Ошибка получения распределения рангов:', error);
        res.status(500).json({ 
            error: 'Не удалось получить распределение рангов',
            details: error.message 
        });
    }
});

// Сохранение/обновление профиля Dota 2 пользователя в базе данных
router.post('/profile/save', async (req, res) => {
    const { user_id, steam_id, dota_stats } = req.body;
    
    if (!user_id || !steam_id) {
        return res.status(400).json({ error: 'Необходимы user_id и steam_id' });
    }
    
    try {
        // Проверяем, существует ли уже запись
        const existingProfile = await pool.query(
            'SELECT id FROM dota_profiles WHERE user_id = $1',
            [user_id]
        );
        
        if (existingProfile.rows.length > 0) {
            // Обновляем существующую запись
            await pool.query(`
                UPDATE dota_profiles 
                SET steam_id = $1, dota_stats = $2, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $3
            `, [steam_id, JSON.stringify(dota_stats), user_id]);
        } else {
            // Создаем новую запись
            await pool.query(`
                INSERT INTO dota_profiles (user_id, steam_id, dota_stats, created_at, updated_at)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [user_id, steam_id, JSON.stringify(dota_stats)]);
        }
        
        res.json({ success: true, message: 'Профиль Dota 2 сохранен' });
        
    } catch (error) {
        console.error('❌ Ошибка сохранения профиля Dota 2:', error);
        res.status(500).json({ 
            error: 'Не удалось сохранить профиль Dota 2',
            details: error.message 
        });
    }
});

// Получение профиля Dota 2 пользователя из базы данных
router.get('/profile/:user_id', async (req, res) => {
    const { user_id } = req.params;
    
    try {
        const profile = await pool.query(
            'SELECT * FROM dota_profiles WHERE user_id = $1',
            [user_id]
        );
        
        if (profile.rows.length === 0) {
            return res.status(404).json({ error: 'Профиль Dota 2 не найден' });
        }
        
        res.json(profile.rows[0]);
        
    } catch (error) {
        console.error('❌ Ошибка получения профиля Dota 2:', error);
        res.status(500).json({ 
            error: 'Не удалось получить профиль Dota 2',
            details: error.message 
        });
    }
});

module.exports = router; 