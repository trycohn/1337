/**
 * 🛡️ TRUST SCORE CALCULATOR
 * Модуль для расчета Trust Score на основе данных Steam аккаунта
 * 
 * @version 1.0.0
 * @date 2025-10-02
 */

/**
 * Вычисляет Trust Score для Steam аккаунта
 * 
 * @param {Object} steamUser - Объект с данными Steam пользователя
 * @param {string} steamUser.steam_id - Steam ID пользователя
 * @param {number} steamUser.account_age_days - Возраст аккаунта в днях
 * @param {number} steamUser.steam_level - Уровень Steam
 * @param {number} steamUser.cs2_hours - Часы в CS2
 * @param {boolean} steamUser.profile_public - Публичность профиля
 * @param {number} steamUser.games_count - Количество игр
 * @param {number} steamUser.vac_bans - Количество VAC банов
 * @param {number} steamUser.game_bans - Количество игровых банов
 * @param {number} steamUser.last_ban_days - Дней с последнего бана
 * @param {boolean} steamUser.is_community_banned - Бан в комьюнити
 * @param {boolean} steamUser.is_trade_banned - Трейд бан
 * @returns {Object} Результат с trust_score, action и details
 */
function calculateTrustScore(steamUser) {
  console.log('🔍 [Trust Score] Начинаем расчет для Steam ID:', steamUser.steam_id);
  
  let score = 50; // Базовый нейтральный счет
  const reasons = []; // Причины изменения счета
  
  // ============================================================================
  // 1. КРИТИЧЕСКИЕ ПРОВЕРКИ (автоматический бан)
  // ============================================================================
  
  // 1.1. Активный VAC бан в CS2 или недавний бан
  if (steamUser.vac_bans > 0) {
    if (steamUser.last_ban_days < 365) {
      console.log('❌ [Trust Score] КРИТИЧНО: VAC бан менее года назад');
      return {
        score: 0,
        action: 'HARD_BAN',
        reason: 'Active VAC ban detected (less than 1 year)',
        details: {
          vac_bans: steamUser.vac_bans,
          last_ban_days: steamUser.last_ban_days,
          critical_check: 'vac_ban_recent'
        }
      };
    }
    
    // Старые VAC баны (>1 года) - снижаем счет, но не баним
    score -= 30;
    reasons.push(`Old VAC ban (${steamUser.last_ban_days} days ago): -30`);
    console.log(`⚠️ [Trust Score] Старый VAC бан: ${steamUser.last_ban_days} дней назад (-30)`);
  }
  
  // 1.2. Игровой бан от Overwatch (недавний)
  if (steamUser.game_bans > 0 && steamUser.last_ban_days < 180) {
    console.log('❌ [Trust Score] КРИТИЧНО: Game ban менее 6 месяцев назад');
    return {
      score: 0,
      action: 'HARD_BAN',
      reason: 'Recent game ban detected (Overwatch/Game ban)',
      details: {
        game_bans: steamUser.game_bans,
        last_ban_days: steamUser.last_ban_days,
        critical_check: 'game_ban_recent'
      }
    };
  }
  
  // 1.3. Community ban
  if (steamUser.is_community_banned) {
    score -= 40;
    reasons.push('Community banned: -40');
    console.log('⚠️ [Trust Score] Community ban (-40)');
  }
  
  // ============================================================================
  // 2. ВОЗРАСТ АККАУНТА
  // ============================================================================
  
  const accountAgeDays = steamUser.account_age_days || 0;
  
  if (accountAgeDays > 1825) { // 5+ лет
    score += 25;
    reasons.push('Account age 5+ years: +25');
    console.log('✅ [Trust Score] Аккаунт 5+ лет (+25)');
  } else if (accountAgeDays > 730) { // 2+ года
    score += 15;
    reasons.push('Account age 2+ years: +15');
    console.log('✅ [Trust Score] Аккаунт 2+ года (+15)');
  } else if (accountAgeDays > 365) { // 1+ год
    score += 5;
    reasons.push('Account age 1+ year: +5');
    console.log('✅ [Trust Score] Аккаунт 1+ год (+5)');
  } else if (accountAgeDays < 90) { // Менее 3 месяцев - подозрительно
    score -= 10;
    reasons.push('Account age < 3 months: -10');
    console.log('⚠️ [Trust Score] Новый аккаунт < 3 месяцев (-10)');
  } else if (accountAgeDays < 30) { // Менее месяца - очень подозрительно
    score -= 30;
    reasons.push('Account age < 1 month: -30');
    console.log('🔴 [Trust Score] Очень новый аккаунт < 1 месяца (-30)');
  }
  
  // ============================================================================
  // 3. STEAM LEVEL
  // ============================================================================
  
  const steamLevel = steamUser.steam_level || 0;
  
  if (steamLevel >= 50) {
    score += 20;
    reasons.push('Steam level 50+: +20');
    console.log('✅ [Trust Score] Steam level 50+ (+20)');
  } else if (steamLevel >= 20) {
    score += 10;
    reasons.push('Steam level 20+: +10');
    console.log('✅ [Trust Score] Steam level 20+ (+10)');
  } else if (steamLevel >= 5) {
    score += 5;
    reasons.push('Steam level 5+: +5');
    console.log('✅ [Trust Score] Steam level 5+ (+5)');
  } else if (steamLevel === 0) {
    score -= 15;
    reasons.push('Steam level 0: -15');
    console.log('⚠️ [Trust Score] Steam level 0 (-15)');
  }
  
  // ============================================================================
  // 4. CS2 ЧАСЫ
  // ============================================================================
  
  const cs2Hours = steamUser.cs2_hours || 0;
  
  if (cs2Hours > 1000) {
    score += 20;
    reasons.push('CS2 hours 1000+: +20');
    console.log('✅ [Trust Score] CS2 часов 1000+ (+20)');
  } else if (cs2Hours > 500) {
    score += 10;
    reasons.push('CS2 hours 500+: +10');
    console.log('✅ [Trust Score] CS2 часов 500+ (+10)');
  } else if (cs2Hours > 100) {
    score += 5;
    reasons.push('CS2 hours 100+: +5');
    console.log('✅ [Trust Score] CS2 часов 100+ (+5)');
  } else if (cs2Hours < 10) {
    score -= 20;
    reasons.push('CS2 hours < 10: -20');
    console.log('⚠️ [Trust Score] CS2 часов < 10 (-20)');
  }
  
  // ============================================================================
  // 5. ПРИВАТНОСТЬ ПРОФИЛЯ
  // ============================================================================
  
  if (steamUser.profile_public) {
    score += 15;
    reasons.push('Public profile: +15');
    console.log('✅ [Trust Score] Публичный профиль (+15)');
  } else {
    score -= 25;
    reasons.push('Private profile: -25');
    console.log('⚠️ [Trust Score] Приватный профиль (-25)');
  }
  
  // ============================================================================
  // 6. КОЛИЧЕСТВО ИГР
  // ============================================================================
  
  const gamesCount = steamUser.games_count || 0;
  
  if (gamesCount > 100) {
    score += 15;
    reasons.push('Games owned 100+: +15');
    console.log('✅ [Trust Score] Игр 100+ (+15)');
  } else if (gamesCount > 50) {
    score += 10;
    reasons.push('Games owned 50+: +10');
    console.log('✅ [Trust Score] Игр 50+ (+10)');
  } else if (gamesCount > 10) {
    score += 5;
    reasons.push('Games owned 10+: +5');
    console.log('✅ [Trust Score] Игр 10+ (+5)');
  } else if (gamesCount === 1) {
    score -= 20;
    reasons.push('Only CS2 owned: -20');
    console.log('⚠️ [Trust Score] Только CS2 в библиотеке (-20)');
  }
  
  // ============================================================================
  // 7. TRADE BAN
  // ============================================================================
  
  if (steamUser.is_trade_banned) {
    score -= 30;
    reasons.push('Trade banned: -30');
    console.log('⚠️ [Trust Score] Trade ban (-30)');
  }
  
  // ============================================================================
  // НОРМАЛИЗАЦИЯ (0-100)
  // ============================================================================
  
  score = Math.max(0, Math.min(100, score));
  
  // ============================================================================
  // ОПРЕДЕЛЕНИЕ ДЕЙСТВИЯ
  // ============================================================================
  
  let action;
  
  if (score < 20) {
    action = 'HARD_BAN'; // Блокировка регистрации
  } else if (score < 40) {
    action = 'SOFT_BAN'; // Требуется дополнительная верификация
  } else if (score < 60) {
    action = 'WATCH_LIST'; // Повышенное внимание
  } else if (score < 80) {
    action = 'NORMAL'; // Обычный пользователь
  } else {
    action = 'TRUSTED'; // Доверенный пользователь
  }
  
  console.log(`📊 [Trust Score] Итоговый счет: ${score}/100, Действие: ${action}`);
  
  return {
    score,
    action,
    reason: action === 'HARD_BAN' ? 'Trust score too low' : null,
    details: {
      account_age_days: accountAgeDays,
      steam_level: steamLevel,
      cs2_hours: cs2Hours,
      profile_public: steamUser.profile_public,
      games_count: gamesCount,
      vac_bans: steamUser.vac_bans,
      game_bans: steamUser.game_bans,
      reasons: reasons
    }
  };
}

module.exports = {
  calculateTrustScore
};

