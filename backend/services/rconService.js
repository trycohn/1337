/**
 * RCON Service для управления CS2 серверами
 * Отправка команд на сервер через RCON протокол
 */

const Rcon = require('rcon-client').Rcon;
const pool = require('../db');

class RconService {
    constructor() {
        this.connections = new Map(); // Кеш активных соединений
        this.connectionTimeout = 5000; // 5 секунд
        this.commandTimeout = 10000; // 10 секунд
    }

    /**
     * Получить данные сервера по ID
     */
    async getServerById(serverId) {
        const result = await pool.query(
            'SELECT * FROM cs2_servers WHERE id = $1 AND is_active = true',
            [serverId]
        );
        
        if (!result.rows[0]) {
            throw new Error(`Сервер с ID ${serverId} не найден или неактивен`);
        }
        
        return result.rows[0];
    }

    /**
     * Создать RCON соединение с сервером
     */
    async connect(server, useCache = false) {
        const connectionKey = `${server.host}:${server.port}`;
        
        // Проверяем существующее соединение (только если useCache=true)
        if (useCache && this.connections.has(connectionKey)) {
            const existing = this.connections.get(connectionKey);
            if (existing.authenticated) {
                console.log(`🔄 RCON переиспользуем соединение ${connectionKey}`);
                return existing;
            }
        }

        try {
            const rcon = await Rcon.connect({
                host: server.host,
                port: server.port,
                password: server.rcon_password,
                timeout: this.connectionTimeout
            });

            if (useCache) {
                this.connections.set(connectionKey, rcon);
            }
            
            console.log(`✅ RCON подключен к серверу ${server.name} (${connectionKey})`);
            return rcon;
            
        } catch (error) {
            console.error(`❌ Ошибка подключения RCON к ${connectionKey}:`, error.message);
            throw new Error(`Не удалось подключиться к серверу: ${error.message}`);
        }
    }

    /**
     * Закрыть RCON соединение
     */
    async disconnect(server) {
        const connectionKey = `${server.host}:${server.port}`;
        const rcon = this.connections.get(connectionKey);
        
        if (rcon) {
            try {
                await rcon.end();
                this.connections.delete(connectionKey);
                console.log(`🔌 RCON отключен от ${connectionKey}`);
            } catch (error) {
                console.error(`Ошибка отключения RCON от ${connectionKey}:`, error.message);
            }
        }
    }

    /**
     * Выполнить RCON команду на сервере
     */
    async executeCommand(serverId, command, options = {}) {
        const startTime = Date.now();
        const { userId = null, lobbyId = null, logToDb = true, useCache = false } = options;
        
        let server, rcon, response, status, errorMessage;
        let shouldCloseConnection = !useCache; // Закрываем если не кешируем
        
        try {
            // Получаем данные сервера
            server = await this.getServerById(serverId);
            
            // Подключаемся (с опцией кеширования)
            rcon = await this.connect(server, useCache);
            
            // Выполняем команду с уменьшенным таймаутом
            const cmdTimeout = command.includes('matchzy_is_match_setup') ? 3000 : this.commandTimeout;
            
            console.log(`🔹 RCON отправка команды: ${command}`);
            
            response = await Promise.race([
                rcon.send(command),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), cmdTimeout)
                )
            ]);
            
            console.log(`🔹 RCON ответ получен, длина: ${response ? response.length : 0} символов`);
            
            status = 'success';
            console.log(`✅ RCON команда выполнена на ${server.name}: ${command}`);
            
        } catch (error) {
            status = 'failed';
            errorMessage = error.message;
            console.error(`❌ Ошибка выполнения RCON команды:`, error.message);
        } finally {
            // Закрываем соединение если не кешируем
            if (shouldCloseConnection && rcon) {
                try {
                    console.log(`🔹 Закрываем RCON соединение...`);
                    await rcon.end();
                    console.log(`🔹 RCON соединение закрыто`);
                } catch (e) {
                    console.error(`⚠️ Ошибка закрытия RCON:`, e.message);
                }
            }
        }
        
        const duration = Date.now() - startTime;
        console.log(`🔹 Общая длительность команды: ${duration}ms`);
        
        // Логируем в БД
        if (logToDb && server) {
            try {
                console.log(`🔹 Логирование в БД (cs2_server_commands)...`);
                await pool.query(
                    `INSERT INTO cs2_server_commands 
                    (server_id, lobby_id, command, response, status, error_message, executed_by, duration_ms)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [serverId, lobbyId, command, response || null, status, errorMessage || null, userId, duration]
                );
                console.log(`🔹 Команда залогирована в БД`);
            } catch (dbError) {
                console.error('❌ Ошибка логирования RCON команды в БД:', dbError.message);
                console.error('❌ Детали ошибки БД:', dbError);
            }
        } else {
            console.log(`🔹 Пропуск логирования в БД (logToDb=${logToDb})`);
        }
        
        if (status === 'failed') {
            throw new Error(errorMessage || 'Не удалось выполнить команду');
        }
        
        return {
            success: true,
            response,
            duration,
            command
        };
    }

    /**
     * Выполнить несколько команд последовательно
     */
    async executeCommands(serverId, commands, options = {}) {
        const results = [];
        
        for (const command of commands) {
            try {
                const result = await this.executeCommand(serverId, command, options);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    command,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Загрузить конфиг матча на сервер
     */
    async loadMatchConfig(serverId, configUrl, options = {}) {
        const command = `get5_loadmatch_url "${configUrl}"`;
        return await this.executeCommand(serverId, command, options);
    }

    /**
     * Проверить статус сервера
     */
    async checkServerStatus(serverId) {
        try {
            const result = await this.executeCommand(
                serverId, 
                'status', 
                { logToDb: false }
            );
            
            // Обновляем статус в БД
            await pool.query(
                `UPDATE cs2_servers 
                SET status = 'online', last_check_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1`,
                [serverId]
            );
            
            return { online: true, response: result.response };
            
        } catch (error) {
            // Обновляем статус на offline
            await pool.query(
                `UPDATE cs2_servers 
                SET status = 'offline', last_check_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = $1`,
                [serverId]
            );
            
            return { online: false, error: error.message };
        }
    }

    /**
     * Закрыть все соединения
     */
    async disconnectAll() {
        const promises = [];
        for (const [key, rcon] of this.connections.entries()) {
            promises.push(
                rcon.end().catch(err => 
                    console.error(`Ошибка закрытия ${key}:`, err.message)
                )
            );
        }
        await Promise.all(promises);
        this.connections.clear();
        console.log('🔌 Все RCON соединения закрыты');
    }
}

// Синглтон
const rconService = new RconService();

// Закрываем соединения при завершении процесса
process.on('SIGINT', async () => {
    await rconService.disconnectAll();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await rconService.disconnectAll();
    process.exit(0);
});

module.exports = rconService;

