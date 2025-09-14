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
        const rawGame = (req.query.game || '').toString();
        const normalized = rawGame
            ? (rawGame.toLowerCase().replace(/[^a-z0-9]+/g, ''))
            : '';

        // Нормализация популярных синонимов
        const normalizeGameKey = (g) => {
            if (!g) return '';
            if (['counterstrike2', 'cs2', 'counterstrikeii'].includes(g)) return 'cs2';
            if (['counterstrike', 'csgo', 'csglobaloffensive'].includes(g)) return 'csgo';
            if (['dota2', 'dota'].includes(g)) return 'dota2';
            return g;
        };
        const gameKey = normalizeGameKey(normalized);

        const start = Date.now();
        console.log(`Поиск карт${rawGame ? ` для игры ${rawGame} [key=${gameKey}]` : ''}`);

        let result;
        if (gameKey) {
            // Сравнение по нормализованному ключу
            result = await db.query(
                `SELECT id, name, game, display_name, image_url, created_at
                 FROM maps
                 WHERE lower(regexp_replace(game, '[^a-z0-9]+', '', 'g')) = $1
                 ORDER BY id ASC`,
                [gameKey]
            );
        } else {
            result = await db.query(
                `SELECT id, name, game, display_name, image_url, created_at
                 FROM maps
                 ORDER BY id ASC`
            );
        }

        // Fallback: если для CS2 нет строк в БД — отдаём дефолтный маппул
        if (gameKey === 'cs2' && (!result || result.rows.length === 0)) {
            const fallback = await db.query(`
                SELECT 
                    NULL::int AS id,
                    lower(regexp_replace(dm.map_name, '^de[_-]?', '')) AS name,
                    'cs2' AS game,
                    COALESCE(m.display_name, dm.map_name) AS display_name,
                    m.image_url,
                    NOW() AS created_at
                FROM default_map_pool dm
                LEFT JOIN maps m
                  ON lower(regexp_replace(m.name, '^de[_-]?', '')) = lower(regexp_replace(dm.map_name, '^de[_-]?', ''))
                ORDER BY dm.display_order ASC, dm.id ASC
            `);
            result = { rows: fallback.rows };
        }

        // Короткий публичный кэш и диагностика
        res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=86400');
        try {
            res.set('ETag', `W/"maps-${gameKey || 'all'}-${result.rows.length}"`);
            res.set('X-Response-Time', `${Date.now() - start}ms`);
        } catch (_) {}

        console.log(`Найдено ${result.rows.length} карт (took ${Date.now() - start}ms)`);
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