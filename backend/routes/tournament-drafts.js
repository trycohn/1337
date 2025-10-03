// backend/routes/tournament-drafts.js
// API для работы с черновиками турниров
// Дата: 3 октября 2025

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pool = require('../db');

/**
 * POST /api/tournaments/drafts
 * Создание или обновление черновика
 */
router.post('/drafts', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { draft_data, current_step, draft_name } = req.body;

    // Валидация
    if (!draft_data || typeof draft_data !== 'object') {
      return res.status(400).json({ 
        error: 'Некорректные данные черновика' 
      });
    }

    if (current_step && (current_step < 1 || current_step > 6)) {
      return res.status(400).json({ 
        error: 'Некорректный номер шага (должен быть 1-6)' 
      });
    }

    // Проверяем существующий черновик пользователя
    const existingDraft = await pool.query(
      `SELECT id FROM tournament_drafts 
       WHERE user_id = $1 
       ORDER BY last_saved_at DESC 
       LIMIT 1`,
      [userId]
    );

    let result;

    if (existingDraft.rows.length > 0) {
      // Обновляем существующий черновик
      const draftId = existingDraft.rows[0].id;
      
      result = await pool.query(
        `UPDATE tournament_drafts 
         SET 
           draft_data = $1,
           current_step = COALESCE($2, current_step),
           draft_name = COALESCE($3, draft_name),
           expires_at = NOW() + INTERVAL '7 days'
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [
          JSON.stringify(draft_data),
          current_step,
          draft_name,
          draftId,
          userId
        ]
      );

      console.log(`✅ Черновик ${draftId} обновлен для пользователя ${userId}`);
    } else {
      // Создаем новый черновик
      result = await pool.query(
        `INSERT INTO tournament_drafts (
           user_id, 
           draft_data, 
           current_step, 
           draft_name,
           meta
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          userId,
          JSON.stringify(draft_data),
          current_step || 1,
          draft_name || 'Черновик турнира',
          JSON.stringify({ auto_saved: true, source: 'wizard' })
        ]
      );

      console.log(`✅ Создан новый черновик для пользователя ${userId}`);
    }

    res.json({
      success: true,
      draft: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка сохранения черновика:', error);
    res.status(500).json({ 
      error: 'Ошибка сохранения черновика',
      details: error.message 
    });
  }
});

/**
 * GET /api/tournaments/drafts
 * Получение всех черновиков пользователя
 */
router.get('/drafts', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
         id,
         draft_data,
         current_step,
         draft_name,
         created_at,
         last_saved_at,
         expires_at,
         meta
       FROM tournament_drafts
       WHERE user_id = $1
       ORDER BY last_saved_at DESC`,
      [userId]
    );

    console.log(`📋 Получено ${result.rows.length} черновиков для пользователя ${userId}`);

    res.json({
      success: true,
      drafts: result.rows
    });

  } catch (error) {
    console.error('❌ Ошибка получения черновиков:', error);
    res.status(500).json({ 
      error: 'Ошибка получения черновиков',
      details: error.message 
    });
  }
});

/**
 * GET /api/tournaments/drafts/:id
 * Получение конкретного черновика
 */
router.get('/drafts/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = req.params.id;

    const result = await pool.query(
      `SELECT * FROM tournament_drafts
       WHERE id = $1 AND user_id = $2`,
      [draftId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Черновик не найден' 
      });
    }

    // Проверяем срок действия
    const draft = result.rows[0];
    if (new Date(draft.expires_at) < new Date()) {
      // Черновик устарел - удаляем
      await pool.query(
        'DELETE FROM tournament_drafts WHERE id = $1',
        [draftId]
      );
      
      return res.status(410).json({ 
        error: 'Черновик устарел и был удален' 
      });
    }

    res.json({
      success: true,
      draft: draft
    });

  } catch (error) {
    console.error('❌ Ошибка получения черновика:', error);
    res.status(500).json({ 
      error: 'Ошибка получения черновика',
      details: error.message 
    });
  }
});

/**
 * PUT /api/tournaments/drafts/:id
 * Обновление черновика
 */
router.put('/drafts/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = req.params.id;
    const { draft_data, current_step, draft_name } = req.body;

    // Проверяем права доступа
    const existingDraft = await pool.query(
      'SELECT id FROM tournament_drafts WHERE id = $1 AND user_id = $2',
      [draftId, userId]
    );

    if (existingDraft.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Черновик не найден или нет доступа' 
      });
    }

    // Обновляем черновик
    const result = await pool.query(
      `UPDATE tournament_drafts 
       SET 
         draft_data = COALESCE($1, draft_data),
         current_step = COALESCE($2, current_step),
         draft_name = COALESCE($3, draft_name),
         expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [
        draft_data ? JSON.stringify(draft_data) : null,
        current_step,
        draft_name,
        draftId,
        userId
      ]
    );

    console.log(`✅ Черновик ${draftId} обновлен`);

    res.json({
      success: true,
      draft: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка обновления черновика:', error);
    res.status(500).json({ 
      error: 'Ошибка обновления черновика',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/tournaments/drafts/:id
 * Удаление черновика
 */
router.delete('/drafts/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const draftId = req.params.id;

    const result = await pool.query(
      'DELETE FROM tournament_drafts WHERE id = $1 AND user_id = $2 RETURNING id',
      [draftId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Черновик не найден или нет доступа' 
      });
    }

    console.log(`🗑️ Черновик ${draftId} удален`);

    res.json({
      success: true,
      message: 'Черновик удален'
    });

  } catch (error) {
    console.error('❌ Ошибка удаления черновика:', error);
    res.status(500).json({ 
      error: 'Ошибка удаления черновика',
      details: error.message 
    });
  }
});

/**
 * POST /api/tournaments/drafts/cleanup
 * Ручная очистка устаревших черновиков (admin only)
 */
router.post('/drafts/cleanup', auth, async (req, res) => {
  try {
    // Проверка прав администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Требуются права администратора' 
      });
    }

    const result = await pool.query('SELECT cleanup_expired_drafts()');
    const deletedCount = result.rows[0].cleanup_expired_drafts;

    console.log(`🧹 Очистка черновиков: удалено ${deletedCount} штук`);

    res.json({
      success: true,
      deleted_count: deletedCount
    });

  } catch (error) {
    console.error('❌ Ошибка очистки черновиков:', error);
    res.status(500).json({ 
      error: 'Ошибка очистки черновиков',
      details: error.message 
    });
  }
});

/**
 * GET /api/tournaments/drafts/stats
 * Статистика по черновикам (для админов)
 */
router.get('/drafts/stats', auth, async (req, res) => {
  try {
    // Проверка прав администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Требуются права администратора' 
      });
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_drafts,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(current_step) as avg_step,
        COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_drafts,
        COUNT(CASE WHEN meta->>'source' = 'wizard' THEN 1 END) as wizard_drafts,
        COUNT(CASE WHEN meta->>'source' = 'manual' THEN 1 END) as manual_drafts
      FROM tournament_drafts
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка получения статистики черновиков:', error);
    res.status(500).json({ 
      error: 'Ошибка получения статистики',
      details: error.message 
    });
  }
});

module.exports = router;

