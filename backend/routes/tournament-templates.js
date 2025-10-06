// backend/routes/tournament-templates.js
// API для работы с шаблонами турниров
// Дата: 3 октября 2025

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../db');

/**
 * GET /api/tournament-templates
 * Получение списка шаблонов турниров
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, official_only } = req.query;
    
    let query = `
      SELECT 
        id,
        name,
        description,
        category,
        thumbnail_url,
        icon,
        is_official,
        use_count,
        config,
        created_at
      FROM tournament_templates
      WHERE is_active = TRUE
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Фильтр по категории
    if (category && category !== 'all') {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    // Поиск по названию
    if (search) {
      query += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Только официальные шаблоны
    if (official_only === 'true') {
      query += ` AND is_official = TRUE`;
    }
    
    // Сортировка: официальные первыми, затем по популярности
    query += ` ORDER BY is_official DESC, use_count DESC, created_at DESC`;
    
    const result = await pool.query(query, params);
    
    console.log(`📋 Получено ${result.rows.length} шаблонов турниров`);
    
    res.json({
      success: true,
      templates: result.rows
    });

  } catch (error) {
    console.error('❌ Ошибка получения шаблонов:', error);
    res.status(500).json({ 
      error: 'Ошибка получения шаблонов',
      details: error.message 
    });
  }
});

/**
 * GET /api/tournament-templates/:id
 * Получение конкретного шаблона
 */
router.get('/:id', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Некорректный ID шаблона' });
    }
    
    const result = await pool.query(
      `SELECT * FROM tournament_templates 
       WHERE id = $1 AND is_active = TRUE`,
      [templateId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }
    
    res.json({
      success: true,
      template: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка получения шаблона:', error);
    res.status(500).json({ 
      error: 'Ошибка получения шаблона',
      details: error.message 
    });
  }
});

/**
 * POST /api/tournament-templates/:id/use
 * Инкремент счетчика использования шаблона
 */
router.post('/:id/use', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Некорректный ID шаблона' });
    }
    
    // Используем функцию из БД
    await pool.query('SELECT increment_template_use_count($1)', [templateId]);
    
    console.log(`📊 Шаблон ${templateId} использован`);
    
    res.json({
      success: true,
      message: 'Счетчик использования обновлен'
    });

  } catch (error) {
    console.error('❌ Ошибка обновления счетчика:', error);
    res.status(500).json({ 
      error: 'Ошибка обновления счетчика',
      details: error.message 
    });
  }
});

/**
 * POST /api/tournament-templates
 * Создание кастомного шаблона (Pro feature - TODO)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, category, config } = req.body;
    
    // Валидация
    if (!name || !config) {
      return res.status(400).json({ 
        error: 'Название и конфигурация обязательны' 
      });
    }
    
    // TODO: Проверка Pro подписки
    // if (req.user.subscription !== 'pro') {
    //   return res.status(403).json({ 
    //     error: 'Требуется Pro подписка для создания кастомных шаблонов' 
    //   });
    // }
    
    const result = await pool.query(
      `INSERT INTO tournament_templates 
       (name, description, category, creator_id, is_official, config)
       VALUES ($1, $2, $3, $4, FALSE, $5)
       RETURNING *`,
      [
        name,
        description || null,
        category || 'custom',
        userId,
        JSON.stringify(config)
      ]
    );
    
    console.log(`✅ Создан кастомный шаблон ${result.rows[0].id} пользователем ${userId}`);
    
    res.status(201).json({
      success: true,
      template: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка создания шаблона:', error);
    res.status(500).json({ 
      error: 'Ошибка создания шаблона',
      details: error.message 
    });
  }
});

/**
 * PUT /api/tournament-templates/:id
 * Обновление шаблона (только свои или admin)
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInt(req.params.id, 10);
    const { name, description, category, icon, is_official, is_active, config } = req.body;
    
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Некорректный ID шаблона' });
    }
    
    // Проверяем права доступа
    const template = await pool.query(
      'SELECT creator_id, is_official FROM tournament_templates WHERE id = $1',
      [templateId]
    );
    
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }
    
    // Только создатель или админ может редактировать
    if (template.rows[0].creator_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на редактирование этого шаблона' });
    }
    
    // Обновляем шаблон
    const result = await pool.query(
      `UPDATE tournament_templates
       SET 
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         icon = COALESCE($4, icon),
         is_official = COALESCE($5, is_official),
         is_active = COALESCE($6, is_active),
         config = COALESCE($7, config)
       WHERE id = $8
       RETURNING *`,
      [
        name || null,
        description || null,
        category || null,
        icon || null,
        is_official !== undefined ? is_official : null,
        is_active !== undefined ? is_active : null,
        config ? JSON.stringify(config) : null,
        templateId
      ]
    );
    
    console.log(`✅ Шаблон ${templateId} обновлен`);
    
    res.json({
      success: true,
      template: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка обновления шаблона:', error);
    res.status(500).json({ 
      error: 'Ошибка обновления шаблона',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/tournament-templates/:id
 * Удаление кастомного шаблона (только свои)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const templateId = parseInt(req.params.id, 10);
    
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Некорректный ID шаблона' });
    }
    
    // Проверяем права доступа
    const template = await pool.query(
      'SELECT creator_id, is_official FROM tournament_templates WHERE id = $1',
      [templateId]
    );
    
    if (template.rows.length === 0) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }
    
    if (template.rows[0].is_official) {
      return res.status(403).json({ error: 'Нельзя удалить официальный шаблон' });
    }
    
    if (template.rows[0].creator_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на удаление этого шаблона' });
    }
    
    // Мягкое удаление (is_active = FALSE)
    await pool.query(
      'UPDATE tournament_templates SET is_active = FALSE WHERE id = $1',
      [templateId]
    );
    
    console.log(`🗑️ Шаблон ${templateId} деактивирован`);
    
    res.json({
      success: true,
      message: 'Шаблон удален'
    });

  } catch (error) {
    console.error('❌ Ошибка удаления шаблона:', error);
    res.status(500).json({ 
      error: 'Ошибка удаления шаблона',
      details: error.message 
    });
  }
});

/**
 * GET /api/tournament-templates/stats
 * Статистика по шаблонам (для админов)
 */
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    // Проверка прав администратора
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Требуются права администратора' 
      });
    }
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_templates,
        COUNT(CASE WHEN is_official = TRUE THEN 1 END) as official_count,
        COUNT(CASE WHEN is_official = FALSE THEN 1 END) as custom_count,
        SUM(use_count) as total_uses,
        AVG(use_count) as avg_uses_per_template
      FROM tournament_templates
      WHERE is_active = TRUE
    `);
    
    res.json({
      success: true,
      stats: stats.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ 
      error: 'Ошибка получения статистики',
      details: error.message 
    });
  }
});

module.exports = router;

