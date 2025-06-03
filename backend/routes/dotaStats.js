const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db');

// Базовый URL STRATZ GraphQL API
const STRATZ_API_BASE = 'https://api.stratz.com/graphql';

// STRATZ API Token (нужно будет добавить в переменные окружения)
const STRATZ_API_TOKEN = process.env.STRATZ_API_TOKEN || 'your-stratz-api-token';

// Функция для выполнения GraphQL запросов к STRATZ API
async function makeStratzRequest(query, variables = {}) {
    try {
        const response = await axios.post(STRATZ_API_BASE, {
            query,
            variables
        }, {
            timeout: 15000,
            headers: {
                'Authorization': `Bearer ${STRATZ_API_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': '1337Community-DotaStats/2.0'
            }
        });
        
        if (response.data.errors) {
            console.error('STRATZ GraphQL errors:', response.data.errors);
            throw new Error(`STRATZ API errors: ${response.data.errors.map(e => e.message).join(', ')}`);
        }
        
        return response.data.data;
    } catch (error) {
        console.error(`Ошибка запроса к STRATZ API:`, error.message);
        throw new Error(`Не удалось получить данные от STRATZ API: ${error.message}`);
    }
}

// Получение информации об игроке по Steam ID
router.get('/player/:steamid', async (req, res) => {
    const { steamid } = req.params;
    
    try {
        console.log(`🔍 Получение статистики игрока Steam ID: ${steamid} через STRATZ API`);
        
        const query = `
            query GetPlayer($steamAccountId: Long!) {
                player(steamAccountId: $steamAccountId) {
                    steamAccountId
                    steamAccount {
                        id
                        name
                        avatar
                        profileUri
                        countryCode
                    }
                    ranks {
                        rank
                        seasonRankId
                        asOfDateTime
                    }
                    mmr {
                        estimate
                    }
                    matchCount
                    winCount
                    heroesPerformance(request: { take: 10 }) {
                        heroId
                        matchCount
                        winCount
                        avgKills
                        avgDeaths
                        avgAssists
                        avgGoldPerMinute
                        avgExperiencePerMinute
                    }
                    matches(request: { take: 10 }) {
                        id
                        startDateTime
                        durationSeconds
                        gameMode
                        lobbyType
                        didRadiantWin
                        players {
                            steamAccountId
                            heroId
                            kills
                            deaths
                            assists
                            goldPerMinute
                            experiencePerMinute
                            level
                            networth
                            isRadiant
                        }
                    }
                    leaderboardRanks {
                        seasonRankId
                        asOfDateTime
                        rank
                        regionId
                    }
                    behaviorScore
                    activity {
                        win
                        lose
                        mvp
                        topCore
                        topSupport
                    }
                }
            }
        `;
        
        // Конвертируем Steam ID в account ID для STRATZ
        const steamAccountId = String(BigInt(steamid) - BigInt('76561197960265728'));
        
        const data = await makeStratzRequest(query, { steamAccountId: Number(steamAccountId) });
        
        if (!data.player) {
            return res.status(404).json({ 
                error: 'Игрок не найден в STRATZ API',
                details: 'Возможно, профиль приватный или игрок не играл в Dota 2'
            });
        }
        
        const player = data.player;
        const latestRank = player.ranks && player.ranks.length > 0 ? player.ranks[0] : null;
        const activity = player.activity || {};
        
        // Определяем MMR из различных источников
        let mmrValue = null;
        let mmrSource = null;
        
        if (latestRank && latestRank.rank && latestRank.rank > 0) {
            mmrValue = latestRank.rank;
            mmrSource = 'ranks';
        } else if (player.mmr?.estimate && player.mmr.estimate > 0) {
            mmrValue = player.mmr.estimate;
            mmrSource = 'mmr_estimate';
        } else if (player.leaderboardRanks && player.leaderboardRanks.length > 0 && player.leaderboardRanks[0].rank) {
            mmrValue = player.leaderboardRanks[0].rank;
            mmrSource = 'leaderboard';
        }
        
        // Отладочная информация
        console.log(`🎯 MMR для игрока ${steamid}:`, {
            mmrValue,
            mmrSource,
            latestRank: latestRank?.rank,
            mmrEstimate: player.mmr?.estimate,
            leaderboardRank: player.leaderboardRanks?.[0]?.rank,
            seasonRankId: latestRank?.seasonRankId
        });
        
        const result = {
            profile: {
                account_id: player.steamAccountId,
                steam_id: steamid,
                avatar: player.steamAccount?.avatar,
                avatarmedium: player.steamAccount?.avatar,
                avatarfull: player.steamAccount?.avatar,
                personaname: player.steamAccount?.name,
                profileurl: player.steamAccount?.profileUri,
                country_code: player.steamAccount?.countryCode,
                rank_tier: latestRank?.seasonRankId,
                mmr_estimate: mmrValue,
                solo_competitive_rank: mmrValue,
                competitive_rank: mmrValue,
                leaderboard_rank: player.leaderboardRanks && player.leaderboardRanks.length > 0 ? 
                    player.leaderboardRanks[0].rank : null,
                behavior_score: player.behaviorScore,
                last_rank_update: latestRank?.asOfDateTime,
                mmr_source: mmrSource
            },
            stats: {
                win: activity.win || 0,
                lose: activity.lose || 0,
                total_matches: player.matchCount || 0,
                winrate: player.matchCount > 0 ? 
                    ((player.winCount / player.matchCount) * 100).toFixed(2) : 0,
                mvp_count: activity.mvp || 0,
                top_core_count: activity.topCore || 0,
                top_support_count: activity.topSupport || 0
            },
            recent_matches: (player.matches || []).map(match => {
                const playerData = match.players.find(p => p.steamAccountId === player.steamAccountId);
                return {
                    match_id: match.id,
                    hero_id: playerData?.heroId,
                    start_time: new Date(match.startDateTime).getTime() / 1000,
                    duration: match.durationSeconds,
                    game_mode: match.gameMode,
                    lobby_type: match.lobbyType,
                    kills: playerData?.kills,
                    deaths: playerData?.deaths,
                    assists: playerData?.assists,
                    gold_per_min: playerData?.goldPerMinute,
                    xp_per_min: playerData?.experiencePerMinute,
                    level: playerData?.level,
                    net_worth: playerData?.networth,
                    is_radiant: playerData?.isRadiant,
                    radiant_win: match.didRadiantWin,
                    win: playerData?.isRadiant === match.didRadiantWin
                };
            }),
            top_heroes: (player.heroesPerformance || []).map(hero => ({
                hero_id: hero.heroId,
                games: hero.matchCount,
                win: hero.winCount,
                winrate: hero.matchCount > 0 ? ((hero.winCount / hero.matchCount) * 100).toFixed(2) : 0,
                avg_kills: hero.avgKills?.toFixed(1),
                avg_deaths: hero.avgDeaths?.toFixed(1),
                avg_assists: hero.avgAssists?.toFixed(1),
                avg_gpm: hero.avgGoldPerMinute?.toFixed(0),
                avg_xpm: hero.avgExperiencePerMinute?.toFixed(0)
            })),
            rankings: player.leaderboardRanks || []
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
        console.log(`🔍 Получение информации о матче: ${matchid} через STRATZ API`);
        
        const query = `
            query GetMatch($matchId: Long!) {
                match(id: $matchId) {
                    id
                    startDateTime
                    durationSeconds
                    gameMode
                    lobbyType
                    didRadiantWin
                    radiantKills
                    direKills
                    radiantTeam {
                        id
                        name
                    }
                    direTeam {
                        id
                        name
                    }
                    players {
                        steamAccountId
                        steamAccount {
                            name
                            avatar
                        }
                        heroId
                        kills
                        deaths
                        assists
                        lastHits
                        denies
                        goldPerMinute
                        experiencePerMinute
                        level
                        networth
                        heroDamage
                        towerDamage
                        heroHealing
                        isRadiant
                        position
                        items {
                            itemId
                            timeCreated
                        }
                        stats {
                            campStack
                            creepsStacked
                            runePowerUpCount
                            runePickupCount
                            wardsPurchased
                            wardsPlaced
                            wardsDestroyed
                        }
                    }
                    analysisOutcome {
                        winRates {
                            radiantWinRate
                            direWinRate
                        }
                    }
                }
            }
        `;
        
        const data = await makeStratzRequest(query, { matchId: Number(matchid) });
        
        if (!data.match) {
            return res.status(404).json({ 
                error: 'Матч не найден в STRATZ API',
                details: 'Возможно, матч слишком старый или не записан в базе данных'
            });
        }
        
        const match = data.match;
        
        const result = {
            match_id: match.id,
            duration: match.durationSeconds,
            start_time: new Date(match.startDateTime).getTime() / 1000,
            radiant_win: match.didRadiantWin,
            game_mode: match.gameMode,
            lobby_type: match.lobbyType,
            radiant_team: {
                id: match.radiantTeam?.id,
                name: match.radiantTeam?.name,
                score: match.radiantKills
            },
            dire_team: {
                id: match.direTeam?.id,
                name: match.direTeam?.name,
                score: match.direKills
            },
            players: match.players.map(player => ({
                account_id: player.steamAccountId,
                personaname: player.steamAccount?.name,
                avatar: player.steamAccount?.avatar,
                hero_id: player.heroId,
                kills: player.kills,
                deaths: player.deaths,
                assists: player.assists,
                last_hits: player.lastHits,
                denies: player.denies,
                gold_per_min: player.goldPerMinute,
                xp_per_min: player.experiencePerMinute,
                level: player.level,
                net_worth: player.networth,
                hero_damage: player.heroDamage,
                tower_damage: player.towerDamage,
                hero_healing: player.heroHealing,
                is_radiant: player.isRadiant,
                position: player.position,
                items: player.items?.map(item => item.itemId) || [],
                stats: {
                    camp_stack: player.stats?.campStack,
                    creeps_stacked: player.stats?.creepsStacked,
                    rune_powerup_count: player.stats?.runePowerUpCount,
                    rune_pickup_count: player.stats?.runePickupCount,
                    wards_purchased: player.stats?.wardsPurchased,
                    wards_placed: player.stats?.wardsPlaced,
                    wards_destroyed: player.stats?.wardsDestroyed
                }
            })),
            win_rates: match.analysisOutcome?.winRates || null
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
        console.log(`🔍 Поиск игрока: ${query} через STRATZ API`);
        
        const searchQuery = `
            query SearchPlayers($request: PlayerSearchRequestType!) {
                search {
                    players(request: $request) {
                        steamAccountId
                        steamAccount {
                            name
                            avatar
                            profileUri
                            countryCode
                        }
                        matchCount
                        winCount
                        lastMatchDateTime
                        ranks {
                            rank
                            seasonRankId
                        }
                    }
                }
            }
        `;
        
        const data = await makeStratzRequest(searchQuery, {
            request: {
                name: query,
                take: 20
            }
        });
        
        const searchResults = data.search?.players || [];
        
        const result = searchResults.map(player => ({
            account_id: player.steamAccountId,
            avatar: player.steamAccount?.avatar,
            avatarmedium: player.steamAccount?.avatar,
            personaname: player.steamAccount?.name,
            profile_url: player.steamAccount?.profileUri,
            country_code: player.steamAccount?.countryCode,
            last_match_time: player.lastMatchDateTime ? 
                new Date(player.lastMatchDateTime).getTime() / 1000 : null,
            match_count: player.matchCount,
            win_count: player.winCount,
            winrate: player.matchCount > 0 ? 
                ((player.winCount / player.matchCount) * 100).toFixed(2) : 0,
            current_rank: player.ranks && player.ranks.length > 0 ? player.ranks[0].rank : null
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
        console.log('🔍 Получение статистики героев через STRATZ API');
        
        const query = `
            query GetHeroStats {
                constants {
                    heroes {
                        id
                        name
                        displayName
                        shortName
                        primaryAttribute
                        attackType
                        roles
                        stats {
                            gameVersionId
                            week
                            matchCount
                            winCount
                            pickCount
                            banCount
                        }
                    }
                }
            }
        `;
        
        const data = await makeStratzRequest(query);
        
        const heroes = data.constants?.heroes || [];
        
        const result = heroes.map(hero => {
            const latestStats = hero.stats && hero.stats.length > 0 ? hero.stats[0] : {};
            
            return {
                hero_id: hero.id,
                name: hero.displayName || hero.name,
                short_name: hero.shortName,
                primary_attr: hero.primaryAttribute,
                attack_type: hero.attackType,
                roles: hero.roles || [],
                pro_pick: latestStats.pickCount || 0,
                pro_win: latestStats.winCount || 0,
                pro_ban: latestStats.banCount || 0,
                total_matches: latestStats.matchCount || 0,
                pick_rate: latestStats.matchCount > 0 ? 
                    ((latestStats.pickCount / latestStats.matchCount) * 100).toFixed(2) : 0,
                win_rate: latestStats.pickCount > 0 ? 
                    ((latestStats.winCount / latestStats.pickCount) * 100).toFixed(2) : 0,
                ban_rate: latestStats.matchCount > 0 ? 
                    ((latestStats.banCount / latestStats.matchCount) * 100).toFixed(2) : 0
            };
        });
        
        // Сортируем по популярности (количество пиков)
        result.sort((a, b) => b.pro_pick - a.pro_pick);
        
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
        console.log('🔍 Получение профессиональных матчей через STRATZ API');
        
        const query = `
            query GetProMatches($request: MatchRequestType!) {
                matches(request: $request) {
                    id
                    startDateTime
                    durationSeconds
                    didRadiantWin
                    radiantKills
                    direKills
                    gameMode
                    lobbyType
                    radiantTeam {
                        id
                        name
                        tag
                    }
                    direTeam {
                        id
                        name
                        tag
                    }
                    league {
                        id
                        displayName
                        tier
                    }
                    series {
                        id
                        type
                    }
                }
            }
        `;
        
        const data = await makeStratzRequest(query, {
            request: {
                take: 50,
                orderBy: "START_DATE_TIME_DESC",
                lobbyTypeIds: [1, 2], // Professional matches
                gameVersionIds: [7, 8, 9] // Recent game versions
            }
        });
        
        const matches = data.matches || [];
        
        const result = matches.map(match => ({
            match_id: match.id,
            duration: match.durationSeconds,
            start_time: new Date(match.startDateTime).getTime() / 1000,
            radiant_team_id: match.radiantTeam?.id,
            radiant_name: match.radiantTeam?.name || match.radiantTeam?.tag,
            dire_team_id: match.direTeam?.id,
            dire_name: match.direTeam?.name || match.direTeam?.tag,
            radiant_score: match.radiantKills,
            dire_score: match.direKills,
            radiant_win: match.didRadiantWin,
            league_name: match.league?.displayName,
            league_tier: match.league?.tier,
            series_type: match.series?.type,
            game_mode: match.gameMode,
            lobby_type: match.lobbyType
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
        console.log('🔍 Получение распределения рангов через STRATZ API');
        
        const query = `
            query GetRankDistributions {
                constants {
                    ranks {
                        rank
                        seasonRankId
                        percentile
                    }
                }
                leaderboard {
                    season {
                        id
                        name
                        startDateTime
                        endDateTime
                    }
                    playerCount
                    players(request: { take: 100 }) {
                        steamAccountId
                        steamAccount {
                            name
                            avatar
                        }
                        rank
                        regionId
                    }
                }
            }
        `;
        
        const data = await makeStratzRequest(query);
        
        const result = {
            ranks: {
                rows: (data.constants?.ranks || []).map(rank => ({
                    bin: rank.seasonRankId,
                    bin_name: `Rank ${rank.seasonRankId}`,
                    game_count: Math.round((rank.percentile || 0) * 1000), // Примерное значение
                    percentile: rank.percentile
                })),
                sum: 100000 // Примерное общее количество игроков
            },
            leaderboard: {
                season: data.leaderboard?.season,
                player_count: data.leaderboard?.playerCount,
                top_players: (data.leaderboard?.players || []).map(player => ({
                    account_id: player.steamAccountId,
                    name: player.steamAccount?.name,
                    avatar: player.steamAccount?.avatar,
                    rank: player.rank,
                    region_id: player.regionId
                }))
            }
        };
        
        res.json(result);
        
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
        
        res.json({ success: true, message: 'Профиль Dota 2 сохранен (STRATZ API)' });
        
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

// Удаление профиля Dota 2 пользователя
router.delete('/profile/:user_id', async (req, res) => {
    const { user_id } = req.params;
    
    try {
        const result = await pool.query(
            'DELETE FROM dota_profiles WHERE user_id = $1 RETURNING id',
            [user_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Профиль Dota 2 не найден' });
        }
        
        res.json({ success: true, message: 'Профиль Dota 2 удален' });
        
    } catch (error) {
        console.error('❌ Ошибка удаления профиля Dota 2:', error);
        res.status(500).json({ 
            error: 'Не удалось удалить профиль Dota 2',
            details: error.message 
        });
    }
});

module.exports = router; 