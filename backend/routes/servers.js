/**
 * API для управления CS2 серверами
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const rconService = require('../services/rconService');

// Middleware для проверки прав администратора
const requireAdmin = (req, res, next) => {
    if (!req.user?.is_admin) {
        return res.status(403).json({ error: 'Требуются права администратора' });
    }
    next();
};

/**
 * Получить список всех серверов
 * GET /api/servers
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { status, location, is_active } = req.query;
        
        let query = 'SELECT * FROM cs2_servers WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (status) {
            query += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (location) {
            query += ` AND location = $${paramIndex++}`;
            params.push(location);
        }
        
        if (is_active !== undefined) {
            query += ` AND is_active = $${paramIndex++}`;
            params.push(is_active === 'true');
        }
        
        query += ' ORDER BY name ASC';
        
        const result = await pool.query(query, params);
        
        // Скрываем пароли в ответе
        const servers = result.rows.map(server => ({
            ...server,
            rcon_password: '***',
            server_password: server.server_password ? '***' : null,
            gotv_password: server.gotv_password ? '***' : null
        }));
        
        res.json({ success: true, servers });
        
    } catch (error) {
        console.error('Ошибка получения списка серверов:', error);
        res.status(500).json({ error: 'Не удалось получить список серверов' });
    }
});

/**
 * Получить данные сервера по ID
 * GET /api/servers/:id
 */
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM cs2_servers WHERE id = $1',
            [id]
        );
        
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'Сервер не найден' });
        }
        
        const server = {
            ...result.rows[0],
            rcon_password: '***',
            server_password: result.rows[0].server_password ? '***' : null,
            gotv_password: result.rows[0].gotv_password ? '***' : null
        };
        
        res.json({ success: true, server });
        
    } catch (error) {
        console.error('Ошибка получения сервера:', error);
        res.status(500).json({ error: 'Не удалось получить данные сервера' });
    }
});

/**
 * Создать новый сервер
 * POST /api/servers
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            description,
            host,
            port,
            rcon_password,
            server_password,
            gotv_host,
            gotv_port,
            gotv_password,
            max_slots,
            location,
            metadata
        } = req.body;
        
        // Валидация обязательных полей
        if (!name || !host || !rcon_password) {
            return res.status(400).json({ 
                error: 'Обязательные поля: name, host, rcon_password' 
            });
        }
        
        const result = await pool.query(
            `INSERT INTO cs2_servers 
            (name, description, host, port, rcon_password, server_password, 
             gotv_host, gotv_port, gotv_password, max_slots, location, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                name,
                description || null,
                host,
                port || 27015,
                rcon_password,
                server_password || null,
                gotv_host || null,
                gotv_port || 27020,
                gotv_password || null,
                max_slots || 10,
                location || null,
                metadata ? JSON.stringify(metadata) : '{}'
            ]
        );
        
        const server = {
            ...result.rows[0],
            rcon_password: '***',
            server_password: result.rows[0].server_password ? '***' : null,
            gotv_password: result.rows[0].gotv_password ? '***' : null
        };
        
        console.log(`✅ Создан новый сервер: ${name} (${host}:${port})`);
        
        res.json({ 
            success: true, 
            server,
            message: 'Сервер успешно создан'
        });
        
    } catch (error) {
        console.error('Ошибка создания сервера:', error);
        
        if (error.code === '23505') { // unique violation
            return res.status(400).json({ error: 'Сервер с таким именем уже существует' });
        }
        
        res.status(500).json({ error: 'Не удалось создать сервер' });
    }
});

/**
 * Обновить данные сервера
 * PUT /api/servers/:id
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            host,
            port,
            rcon_password,
            server_password,
            gotv_host,
            gotv_port,
            gotv_password,
            status,
            max_slots,
            location,
            is_active,
            metadata
        } = req.body;
        
        // Проверяем существование сервера
        const existing = await pool.query('SELECT id FROM cs2_servers WHERE id = $1', [id]);
        if (!existing.rows[0]) {
            return res.status(404).json({ error: 'Сервер не найден' });
        }
        
        const updates = [];
        const params = [];
        let paramIndex = 1;
        
        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`);
            params.push(name);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            params.push(description);
        }
        if (host !== undefined) {
            updates.push(`host = $${paramIndex++}`);
            params.push(host);
        }
        if (port !== undefined) {
            updates.push(`port = $${paramIndex++}`);
            params.push(port);
        }
        if (rcon_password !== undefined) {
            updates.push(`rcon_password = $${paramIndex++}`);
            params.push(rcon_password);
        }
        if (server_password !== undefined) {
            updates.push(`server_password = $${paramIndex++}`);
            params.push(server_password);
        }
        if (gotv_host !== undefined) {
            updates.push(`gotv_host = $${paramIndex++}`);
            params.push(gotv_host);
        }
        if (gotv_port !== undefined) {
            updates.push(`gotv_port = $${paramIndex++}`);
            params.push(gotv_port);
        }
        if (gotv_password !== undefined) {
            updates.push(`gotv_password = $${paramIndex++}`);
            params.push(gotv_password);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            params.push(status);
        }
        if (max_slots !== undefined) {
            updates.push(`max_slots = $${paramIndex++}`);
            params.push(max_slots);
        }
        if (location !== undefined) {
            updates.push(`location = $${paramIndex++}`);
            params.push(location);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`);
            params.push(is_active);
        }
        if (metadata !== undefined) {
            updates.push(`metadata = $${paramIndex++}`);
            params.push(JSON.stringify(metadata));
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);
        
        const query = `UPDATE cs2_servers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        
        const result = await pool.query(query, params);
        
        const server = {
            ...result.rows[0],
            rcon_password: '***',
            server_password: result.rows[0].server_password ? '***' : null,
            gotv_password: result.rows[0].gotv_password ? '***' : null
        };
        
        console.log(`✅ Сервер обновлен: ${server.name}`);
        
        res.json({ 
            success: true, 
            server,
            message: 'Сервер успешно обновлен'
        });
        
    } catch (error) {
        console.error('Ошибка обновления сервера:', error);
        res.status(500).json({ error: 'Не удалось обновить сервер' });
    }
});

/**
 * Удалить сервер
 * DELETE /api/servers/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM cs2_servers WHERE id = $1 RETURNING name',
            [id]
        );
        
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'Сервер не найден' });
        }
        
        console.log(`🗑️ Сервер удален: ${result.rows[0].name}`);
        
        res.json({ 
            success: true, 
            message: `Сервер "${result.rows[0].name}" успешно удален` 
        });
        
    } catch (error) {
        console.error('Ошибка удаления сервера:', error);
        res.status(500).json({ error: 'Не удалось удалить сервер' });
    }
});

/**
 * Проверить статус сервера (RCON подключение)
 * POST /api/servers/:id/check
 */
router.post('/:id/check', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const status = await rconService.checkServerStatus(id);
        
        res.json({ 
            success: true, 
            status,
            message: status.online ? 'Сервер онлайн' : 'Сервер офлайн'
        });
        
    } catch (error) {
        console.error('Ошибка проверки статуса сервера:', error);
        res.status(500).json({ error: 'Не удалось проверить статус сервера' });
    }
});

/**
 * Выполнить RCON команду на сервере
 * POST /api/servers/:id/command
 */
router.post('/:id/command', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { command, lobby_id } = req.body;
        
        if (!command) {
            return res.status(400).json({ error: 'Необходимо указать команду' });
        }
        
        const result = await rconService.executeCommand(
            id, 
            command, 
            {
                userId: req.user.id,
                lobbyId: lobby_id || null
            }
        );
        
        res.json({ 
            success: true, 
            result,
            message: 'Команда выполнена успешно'
        });
        
    } catch (error) {
        console.error('Ошибка выполнения RCON команды:', error);
        res.status(500).json({ error: error.message || 'Не удалось выполнить команду' });
    }
});

/**
 * Получить историю команд сервера
 * GET /api/servers/:id/commands
 */
router.get('/:id/commands', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const result = await pool.query(
            `SELECT 
                c.*,
                u.username as executed_by_username
            FROM cs2_server_commands c
            LEFT JOIN users u ON u.id = c.executed_by
            WHERE c.server_id = $1
            ORDER BY c.executed_at DESC
            LIMIT $2 OFFSET $3`,
            [id, limit, offset]
        );
        
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM cs2_server_commands WHERE server_id = $1',
            [id]
        );
        
        res.json({ 
            success: true, 
            commands: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('Ошибка получения истории команд:', error);
        res.status(500).json({ error: 'Не удалось получить историю команд' });
    }
});

module.exports = router;

