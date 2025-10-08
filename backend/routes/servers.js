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
    if (!req.user || req.user.role !== 'admin') {
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
            gotv_password: server.gotv_password ? '***' : null,
            db_password: server.db_password ? '***' : null
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
            gotv_password: result.rows[0].gotv_password ? '***' : null,
            db_password: result.rows[0].db_password ? '***' : null
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
            host,
            port,
            rcon_password,
            db_host,
            db_port,
            db_user,
            db_password,
            db_name
        } = req.body;
        
        // Валидация обязательных полей
        if (!name || !host || !rcon_password) {
            return res.status(400).json({ 
                error: 'Обязательные поля: name, host, rcon_password' 
            });
        }
        
        const serverPort = port || 27015;
        
        const result = await pool.query(
            `INSERT INTO cs2_servers 
            (name, host, port, rcon_password, gotv_host, gotv_port,
             db_host, db_port, db_user, db_password, db_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *`,
            [
                name,
                host,
                serverPort,
                rcon_password,
                host, // GOTV использует тот же IP
                serverPort, // GOTV использует тот же порт
                db_host || null,
                db_port || 3306,
                db_user || null,
                db_password || null,
                db_name || null
            ]
        );
        
        const server = {
            ...result.rows[0],
            rcon_password: '***',
            server_password: result.rows[0].server_password ? '***' : null,
            gotv_password: result.rows[0].gotv_password ? '***' : null,
            db_password: result.rows[0].db_password ? '***' : null
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
            host,
            port,
            rcon_password,
            db_host,
            db_port,
            db_user,
            db_password,
            db_name
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
        if (host !== undefined) {
            updates.push(`host = $${paramIndex++}, gotv_host = $${paramIndex++}`);
            params.push(host);
            params.push(host); // GOTV использует тот же IP
        }
        if (port !== undefined) {
            updates.push(`port = $${paramIndex++}, gotv_port = $${paramIndex++}`);
            params.push(port);
            params.push(port); // GOTV использует тот же порт
        }
        if (rcon_password !== undefined && rcon_password !== '') {
            updates.push(`rcon_password = $${paramIndex++}`);
            params.push(rcon_password);
        }
        if (db_host !== undefined) {
            updates.push(`db_host = $${paramIndex++}`);
            params.push(db_host || null);
        }
        if (db_port !== undefined) {
            updates.push(`db_port = $${paramIndex++}`);
            params.push(db_port || 3306);
        }
        if (db_user !== undefined) {
            updates.push(`db_user = $${paramIndex++}`);
            params.push(db_user || null);
        }
        if (db_password !== undefined && db_password !== '') {
            updates.push(`db_password = $${paramIndex++}`);
            params.push(db_password);
        }
        if (db_name !== undefined) {
            updates.push(`db_name = $${paramIndex++}`);
            params.push(db_name || null);
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);
        
        const query = `UPDATE cs2_servers SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        
        const result = await pool.query(query, params);
        
        const server = {
            ...result.rows[0],
            rcon_password: '***',
            server_password: result.rows[0].server_password ? '***' : null,
            gotv_password: result.rows[0].gotv_password ? '***' : null,
            db_password: result.rows[0].db_password ? '***' : null
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

module.exports = router;

