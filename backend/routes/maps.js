// backend/routes/maps.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Получение списка всех карт с возможностью фильтрации по игре
router.get('/', async (req, res) => {
    try {
        const { game } = req.query;
        
        let query = 'SELECT * FROM maps';
        let params = [];
        
        if (game) {
            query += ' WHERE game = $1';
            params.push(game);
        }
        
        query += ' ORDER BY game, display_name, name';
        
        const result = await pool.query(query, params);
        
        console.log(`🔍 Получено ${result.rows.length} карт${game ? ` для игры ${game}` : ''}`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Ошибка получения списка карт:', err);
        res.status(500).json({ error: err.message });
    }
});

// Получение карт для конкретной игры (альтернативный маршрут)
router.get('/game/:game', async (req, res) => {
    try {
        const { game } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM maps WHERE game = $1 ORDER BY display_name, name',
            [game]
        );
        
        console.log(`🔍 Получено ${result.rows.length} карт для игры ${game}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`❌ Ошибка получения карт для игры ${req.params.game}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// Добавление новой карты (только для админов)
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Проверка прав доступа (админ)
        if (!req.user.is_admin) {
            return res.status(403).json({ error: 'Только администраторы могут добавлять карты' });
        }
        
        const { name, game, display_name, image_url } = req.body;
        
        // Проверка обязательных полей
        if (!name || !game) {
            return res.status(400).json({ error: 'Поля name и game обязательны' });
        }
        
        const result = await pool.query(
            'INSERT INTO maps (name, game, display_name, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, game, display_name || name, image_url]
        );
        
        console.log(`✅ Карта "${name}" для игры "${game}" успешно добавлена`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('❌ Ошибка добавления карты:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router; 