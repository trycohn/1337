/**
 * 🛡️ STEAM TRUST FACTOR SERVICE
 * Интеграция со Steam Web API для получения данных аккаунта
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

const axios = require('axios');
const { calculateTrustScore } = require('./trustScoreCalculator');
const pool = require('../../db');

/**
 * Конвертирует SteamID64 в SteamID32 (если нужно)
 * @param {string} steamId64 - Steam ID в формате 64-bit
 * @returns {string} Steam ID в формате 32-bit
 */
function convertSteamId64To32(steamId64) {
  const base = BigInt('76561197960265728');
  const id = BigInt(steamId64);
  return (id - base).toString();
}

/**
 * Получает данные Steam профиля через API
 * @param {string} steamId64 - Steam ID пользователя
 * @returns {Promise<Object>} Данные профиля
 */
async function getSteamProfileData(steamId64) {
  const apiKey = process.env.STEAM_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ [Steam API] STEAM_API_KEY не найден в .env, используем fallback');
    return null;
  }
  
  try {
    console.log(`📡 [Steam API] Запрос данных для Steam ID: ${steamId64}`);
    
    // 1. Получить базовые данные профиля
    const summaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/`;
    const summaryResponse = await axios.get(summaryUrl, {
      params: {
        key: apiKey,
        steamids: steamId64
      },
      timeout: 10000
    });
    
    if (!summaryResponse.data?.response?.players?.length) {
      console.error('❌ [Steam API] Профиль не найден');
      return null;
    }
    
    const player = summaryResponse.data.response.players[0];
    console.log(`✅ [Steam API] Получены данные профиля для: ${player.personaname}`);
    
    // 2. Получить данные о банах
    const bansUrl = `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/`;
    const bansResponse = await axios.get(bansUrl, {
      params: {
        key: apiKey,
        steamids: steamId64
      },
      timeout: 10000
    });
    
    const bans = bansResponse.data?.players?.[0] || {};
    console.log(`✅ [Steam API] Получены данные о банах:`, {
      vac: bans.NumberOfVACBans || 0,
      game: bans.NumberOfGameBans || 0,
      days_since: bans.DaysSinceLastBan || null
    });
    
    // 3. Получить owned games (если профиль публичный)
    let ownedGames = [];
    let cs2Hours = 0;
    
    try {
      const gamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/`;
      const gamesResponse = await axios.get(gamesUrl, {
        params: {
          key: apiKey,
          steamid: steamId64,
          include_played_free_games: 1,
          include_appinfo: 0
        },
        timeout: 10000
      });
      
      if (gamesResponse.data?.response?.games) {
        ownedGames = gamesResponse.data.response.games;
        console.log(`✅ [Steam API] Получен список игр: ${ownedGames.length} игр`);
        
        // Найти CS2 (App ID 730)
        const cs2Game = ownedGames.find(g => g.appid === 730);
        if (cs2Game) {
          cs2Hours = Math.floor(cs2Game.playtime_forever / 60);
          console.log(`✅ [Steam API] CS2 часов: ${cs2Hours}`);
        } else {
          console.log('ℹ️ [Steam API] CS2 не найден в библиотеке');
        }
      }
    } catch (gamesError) {
      console.warn('⚠️ [Steam API] Не удалось получить список игр (приватный профиль?)');
    }
    
    // 4. Вычислить возраст аккаунта
    const accountCreated = player.timecreated 
      ? new Date(player.timecreated * 1000)
      : null;
    
    const accountAgeDays = accountCreated
      ? Math.floor((Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    console.log(`✅ [Steam API] Возраст аккаунта: ${accountAgeDays} дней`);
    
    // 5. Определить публичность профиля
    // communityvisibilitystate: 1 = private, 3 = public
    const isPublic = player.communityvisibilitystate === 3;
    
    // 6. Собрать все данные
    const steamUserData = {
      steam_id: steamId64,
      profile_url: player.profileurl,
      nickname: player.personaname,
      avatar: player.avatarfull || player.avatarmedium || player.avatar,
      
      // Account quality
      account_age_days: accountAgeDays,
      account_created: accountCreated,
      steam_level: 0, // Получим отдельным запросом если нужно
      
      // Privacy
      profile_public: isPublic,
      profile_private: !isPublic,
      
      // Bans
      vac_bans: bans.NumberOfVACBans || 0,
      game_bans: bans.NumberOfGameBans || 0,
      last_ban_days: bans.DaysSinceLastBan || null,
      is_community_banned: bans.CommunityBanned || false,
      is_economy_banned: bans.EconomyBan !== 'none',
      is_trade_banned: bans.EconomyBan === 'banned',
      
      // Games
      games_count: ownedGames.length,
      cs2_hours: cs2Hours,
      cs2_owned: cs2Hours > 0 || ownedGames.some(g => g.appid === 730)
    };
    
    return steamUserData;
    
  } catch (error) {
    console.error('❌ [Steam API] Ошибка получения данных:', error.message);
    
    // При ошибке API возвращаем минимальные данные
    return {
      steam_id: steamId64,
      error: error.message,
      fallback: true
    };
  }
}

/**
 * Проверяет Steam аккаунт и вычисляет Trust Score
 * 
 * @param {string} steamId64 - Steam ID пользователя
 * @param {number} userId - ID пользователя в нашей БД (опционально)
 * @returns {Promise<Object>} Результат проверки с trust_score и action
 */
async function verifyUserSteamAccount(steamId64, userId = null) {
  console.log('🛡️ [AntiCheat] Начинаем проверку Steam аккаунта:', steamId64);
  
  try {
    // 1. Получить данные из Steam API
    const steamUser = await getSteamProfileData(steamId64);
    
    if (!steamUser) {
      console.warn('⚠️ [AntiCheat] Не удалось получить данные Steam, используем fallback');
      
      // Fallback: минимальная проверка
      return {
        score: 30,
        action: 'WATCH_LIST',
        error: 'Steam API unavailable',
        details: {
          steam_id: steamId64,
          fallback: true
        }
      };
    }
    
    // Если Steam API вернул ошибку, но мы получили fallback данные
    if (steamUser.fallback) {
      return {
        score: 30,
        action: 'WATCH_LIST',
        error: steamUser.error,
        details: steamUser
      };
    }
    
    // 2. Вычислить Trust Score
    const trustResult = calculateTrustScore(steamUser);
    
    console.log(`✅ [AntiCheat] Trust Score вычислен: ${trustResult.score}/100 (${trustResult.action})`);
    
    // 3. Сохранить в БД (если передан userId)
    if (userId) {
      await saveTrustScore(userId, steamId64, trustResult, steamUser);
    }
    
    return trustResult;
    
  } catch (error) {
    console.error('❌ [AntiCheat] Ошибка проверки Steam аккаунта:', error);
    
    // При критической ошибке считаем подозрительным
    return {
      score: 20,
      action: 'WATCH_LIST',
      error: error.message,
      details: {
        steam_id: steamId64,
        critical_error: true
      }
    };
  }
}

/**
 * Сохраняет Trust Score в базу данных
 * 
 * @param {number} userId - ID пользователя
 * @param {string} steamId - Steam ID
 * @param {Object} trustResult - Результат расчета Trust Score
 * @param {Object} steamUser - Данные Steam пользователя
 */
async function saveTrustScore(userId, steamId, trustResult, steamUser) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем, существует ли запись
    const existingResult = await client.query(
      'SELECT id, trust_score, trust_action FROM user_trust_scores WHERE user_id = $1',
      [userId]
    );
    
    if (existingResult.rows.length > 0) {
      // Обновляем существующую запись
      const oldScore = existingResult.rows[0].trust_score;
      const oldAction = existingResult.rows[0].trust_action;
      
      await client.query(`
        UPDATE user_trust_scores SET
          trust_score = $1,
          trust_action = $2,
          account_age_days = $3,
          steam_level = $4,
          cs2_hours = $5,
          vac_bans = $6,
          game_bans = $7,
          last_ban_days = $8,
          profile_public = $9,
          games_count = $10,
          is_community_banned = $11,
          is_trade_banned = $12,
          checked_at = NOW(),
          check_count = check_count + 1,
          details = $13
        WHERE user_id = $14
      `, [
        trustResult.score,
        trustResult.action,
        steamUser.account_age_days,
        steamUser.steam_level || 0,
        steamUser.cs2_hours,
        steamUser.vac_bans,
        steamUser.game_bans,
        steamUser.last_ban_days,
        steamUser.profile_public,
        steamUser.games_count,
        steamUser.is_community_banned,
        steamUser.is_trade_banned,
        JSON.stringify(trustResult.details),
        userId
      ]);
      
      // Записать в историю, если изменился
      if (oldScore !== trustResult.score || oldAction !== trustResult.action) {
        await client.query(`
          INSERT INTO user_trust_history (
            user_id, old_score, new_score, old_action, new_action, reason
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          userId,
          oldScore,
          trustResult.score,
          oldAction,
          trustResult.action,
          'Periodic recheck'
        ]);
        
        console.log(`📊 [Trust Score] История обновлена: ${oldScore} → ${trustResult.score}`);
      }
      
      console.log(`✅ [Trust Score] Обновлен для user_id=${userId}`);
      
    } else {
      // Создаем новую запись
      await client.query(`
        INSERT INTO user_trust_scores (
          user_id, steam_id, trust_score, trust_action,
          account_age_days, steam_level, cs2_hours,
          vac_bans, game_bans, last_ban_days,
          profile_public, games_count,
          is_community_banned, is_trade_banned,
          details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        userId,
        steamId,
        trustResult.score,
        trustResult.action,
        steamUser.account_age_days,
        steamUser.steam_level || 0,
        steamUser.cs2_hours,
        steamUser.vac_bans,
        steamUser.game_bans,
        steamUser.last_ban_days,
        steamUser.profile_public,
        steamUser.games_count,
        steamUser.is_community_banned,
        steamUser.is_trade_banned,
        JSON.stringify(trustResult.details)
      ]);
      
      console.log(`✅ [Trust Score] Создан новый для user_id=${userId}`);
    }
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [Trust Score] Ошибка сохранения в БД:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Проверяет, нужно ли перепроверить Trust Score пользователя
 * 
 * @param {number} userId - ID пользователя
 * @returns {Promise<boolean>} true если нужна перепроверка
 */
async function needsTrustScoreRecheck(userId) {
  try {
    const result = await pool.query(
      'SELECT checked_at FROM user_trust_scores WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return true; // Нет записи - нужна проверка
    }
    
    const lastCheck = new Date(result.rows[0].checked_at);
    const daysSinceCheck = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60 * 24);
    
    // Перепроверяем раз в 7 дней
    return daysSinceCheck > 7;
    
  } catch (error) {
    console.error('❌ [Trust Score] Ошибка проверки необходимости recheck:', error);
    return true; // При ошибке лучше перепроверить
  }
}

module.exports = {
  verifyUserSteamAccount,
  saveTrustScore,
  needsTrustScoreRecheck,
  getSteamProfileData
};

