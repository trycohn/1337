/**
 * 🛡️ ANTICHEAT SERVICE - Главный модуль
 * Система Trust Scores для борьбы с читерами
 * 
 * @version 1.0.0 (MVP)
 * @date 2025-10-02
 * 
 * @description
 * Модуль предоставляет функции для:
 * - Проверки Steam аккаунтов через Steam Web API
 * - Расчета Trust Score (0-100)
 * - Автоматической блокировки VAC-банов
 * - Сохранения данных в БД
 * 
 * @example
 * const { verifyUserSteamAccount } = require('./services/antiCheat');
 * 
 * const trustResult = await verifyUserSteamAccount('76561198012345678', userId);
 * 
 * if (trustResult.action === 'HARD_BAN') {
 *   // Блокируем пользователя
 *   return res.status(403).json({ error: trustResult.reason });
 * }
 */

const {
  verifyUserSteamAccount,
  saveTrustScore,
  needsTrustScoreRecheck,
  getSteamProfileData
} = require('./steamTrustFactor');

const {
  calculateTrustScore
} = require('./trustScoreCalculator');

// Экспортируем все функции
module.exports = {
  // Основные функции
  verifyUserSteamAccount,
  saveTrustScore,
  needsTrustScoreRecheck,
  
  // Вспомогательные функции
  getSteamProfileData,
  calculateTrustScore,
  
  // Константы
  TRUST_ACTIONS: {
    HARD_BAN: 'HARD_BAN',       // Полная блокировка
    SOFT_BAN: 'SOFT_BAN',       // Требуется верификация
    WATCH_LIST: 'WATCH_LIST',   // Повышенное внимание
    NORMAL: 'NORMAL',           // Обычный пользователь
    TRUSTED: 'TRUSTED'          // Доверенный пользователь
  },
  
  // Пороги Trust Score
  TRUST_THRESHOLDS: {
    HARD_BAN: 20,
    SOFT_BAN: 40,
    WATCH_LIST: 60,
    NORMAL: 80
  }
};

