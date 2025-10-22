/**
 * 🏆 ACHIEVEMENTS ROUTES
 * API для достижений и глобального лидерборда
 * @version 1.0.0
 */

const express = require('express');
const AchievementsController = require('../controllers/AchievementsController');

const router = express.Router();

// ============================================================================
// ПУБЛИЧНЫЕ ENDPOINTS
// ============================================================================

// 🌍 Глобальный лидерборд MVP
// Query params: limit (default 50), sort (global_mvp_score|total_mvp_count|gold_medals)
router.get('/global-leaderboard', AchievementsController.getGlobalLeaderboard);

// 👤 Достижения конкретного пользователя
router.get('/user/:userId', AchievementsController.getUserAchievements);

// 📊 Глобальный ранг пользователя
router.get('/user/:userId/rank', AchievementsController.getUserGlobalRank);

// 📋 Конфигурация наград (сколько монет за каждый ранг)
router.get('/rewards-config', AchievementsController.getRewardsConfig);

module.exports = router; 
