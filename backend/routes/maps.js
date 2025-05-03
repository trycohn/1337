// backend/routes/maps.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route GET /api/maps
 * @desc Получить все карты
 * @access Public
 */
router.get('/', async (req, res) => {
    try {
        const gameFilter = req.query.game ? `WHERE game = $1` : '';
        const queryParams = req.query.game ? [req.query.game] : [];

        console.log(`Поиск карт${req.query.game ? ` для игры ${req.query.game}` : ''}`);

        const mapsQuery = `
            SELECT id, name, game, display_name, image_url, created_at
            FROM maps
            ${gameFilter}
            ORDER BY id ASC
        `;
        
        const result = await db.query(mapsQuery, queryParams);
        console.log(`Найдено ${result.rows.length} карт`);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка при получении карт:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route GET /api/maps/:id
 * @desc Получить карту по ID
 * @access Public
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const mapQuery = `
            SELECT id, name, game, display_name, image_url, created_at
            FROM maps
            WHERE id = $1
        `;
        
        const result = await db.query(mapQuery, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Карта не найдена' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при получении карты:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route POST /api/maps
 * @desc Создать новую карту (требуется авторизация админа)
 * @access Private (Admin)
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, game, display_name, image_url } = req.body;
        
        // Проверяем, является ли пользователь администратором
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа. Требуются права администратора' });
        }
        
        // Проверяем обязательные поля
        if (!name || !game) {
            return res.status(400).json({ error: 'Требуются поля name и game' });
        }
        
        // Проверяем существование карты с таким именем для этой игры
        const existingMap = await db.query(
            'SELECT id FROM maps WHERE name = $1 AND game = $2',
            [name, game]
        );
        
        if (existingMap.rows.length > 0) {
            return res.status(400).json({ error: 'Карта с таким именем для этой игры уже существует' });
        }
        
        // Создаём карту
        const insertQuery = `
            INSERT INTO maps (name, game, display_name, image_url, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, name, game, display_name, image_url, created_at
        `;
        
        const result = await db.query(
            insertQuery, 
            [name, game, display_name || name, image_url || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании карты:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route PUT /api/maps/:id
 * @desc Обновить карту (требуется авторизация админа)
 * @access Private (Admin)
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, game, display_name, image_url } = req.body;
        
        // Проверяем, является ли пользователь администратором
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа. Требуются права администратора' });
        }
        
        // Проверяем, существует ли карта
        const existingMap = await db.query('SELECT id FROM maps WHERE id = $1', [id]);
        
        if (existingMap.rows.length === 0) {
            return res.status(404).json({ error: 'Карта не найдена' });
        }
        
        // Обновляем карту
        const updateQuery = `
            UPDATE maps
            SET 
                name = COALESCE($1, name),
                game = COALESCE($2, game),
                display_name = COALESCE($3, display_name),
                image_url = COALESCE($4, image_url)
            WHERE id = $5
            RETURNING id, name, game, display_name, image_url, created_at
        `;
        
        const result = await db.query(
            updateQuery, 
            [name, game, display_name, image_url, id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при обновлении карты:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route DELETE /api/maps/:id
 * @desc Удалить карту (требуется авторизация админа)
 * @access Private (Admin)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем, является ли пользователь администратором
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа. Требуются права администратора' });
        }
        
        // Проверяем, существует ли карта
        const existingMap = await db.query('SELECT id FROM maps WHERE id = $1', [id]);
        
        if (existingMap.rows.length === 0) {
            return res.status(404).json({ error: 'Карта не найдена' });
        }
        
        // Удаляем карту
        await db.query('DELETE FROM maps WHERE id = $1', [id]);
        
        res.json({ message: 'Карта успешно удалена' });
    } catch (error) {
        console.error('Ошибка при удалении карты:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = router; 