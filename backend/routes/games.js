const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../auth');

/**
 * @route GET /api/games
 * @desc Получить все игры
 * @access Public
 */
router.get('/', async (req, res) => {
    try {
        const gamesQuery = `
            SELECT id, name, description, image_url, created_at
            FROM games
            ORDER BY id ASC
        `;
        
        const result = await db.query(gamesQuery);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка при получении игр:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route GET /api/games/:id
 * @desc Получить игру по ID
 * @access Public
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const gameQuery = `
            SELECT id, name, description, image_url, created_at
            FROM games
            WHERE id = $1
        `;
        
        const result = await db.query(gameQuery, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при получении игры:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route POST /api/games
 * @desc Создать новую игру (требуется авторизация админа)
 * @access Private (Admin)
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description, image_url } = req.body;
        
        // Проверяем, является ли пользователь администратором
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа. Требуются права администратора' });
        }
        
        // Проверяем обязательные поля
        if (!name) {
            return res.status(400).json({ error: 'Требуется поле name' });
        }
        
        // Проверяем существование игры с таким именем
        const existingGame = await db.query(
            'SELECT id FROM games WHERE name = $1',
            [name]
        );
        
        if (existingGame.rows.length > 0) {
            return res.status(400).json({ error: 'Игра с таким именем уже существует' });
        }
        
        // Создаём игру
        const insertQuery = `
            INSERT INTO games (name, description, image_url, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, name, description, image_url, created_at
        `;
        
        const result = await db.query(
            insertQuery, 
            [name, description || null, image_url || null]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании игры:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route PUT /api/games/:id
 * @desc Обновить игру (требуется авторизация админа)
 * @access Private (Admin)
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, image_url } = req.body;
        
        // Проверяем, является ли пользователь администратором
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа. Требуются права администратора' });
        }
        
        // Проверяем, существует ли игра
        const existingGame = await db.query('SELECT id FROM games WHERE id = $1', [id]);
        
        if (existingGame.rows.length === 0) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        // Обновляем игру
        const updateQuery = `
            UPDATE games
            SET 
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                image_url = COALESCE($3, image_url)
            WHERE id = $4
            RETURNING id, name, description, image_url, created_at
        `;
        
        const result = await db.query(
            updateQuery, 
            [name, description, image_url, id]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при обновлении игры:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

/**
 * @route DELETE /api/games/:id
 * @desc Удалить игру (требуется авторизация админа)
 * @access Private (Admin)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем, является ли пользователь администратором
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Нет доступа. Требуются права администратора' });
        }
        
        // Проверяем, существует ли игра
        const existingGame = await db.query('SELECT id FROM games WHERE id = $1', [id]);
        
        if (existingGame.rows.length === 0) {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        
        // Удаляем игру
        await db.query('DELETE FROM games WHERE id = $1', [id]);
        
        res.json({ message: 'Игра успешно удалена' });
    } catch (error) {
        console.error('Ошибка при удалении игры:', error);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

module.exports = router; 