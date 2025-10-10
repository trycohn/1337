/**
 * 🎬 DEMO FILES API
 * Прием и раздача .dem файлов от MatchZy
 * 
 * @version 1.0.0
 * @date 2025-10-10
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pool = require('../db');

// Директория для хранения демок
const DEMOS_DIR = path.join(__dirname, '../uploads/demos');
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 ГБ

// Убедимся что директория существует
if (!fs.existsSync(DEMOS_DIR)) {
    fs.mkdirSync(DEMOS_DIR, { recursive: true });
}

/**
 * POST /api/demos/upload
 * Webhook для загрузки демок от MatchZy
 */
router.post('/upload', async (req, res) => {
    console.log('🎬 [Demos] Получен запрос на загрузку демки');
    
    try {
        // 1. Проверка авторизации
        const authHeader = req.headers['authorization'];
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token || token !== process.env.MATCHZY_SECRET_TOKEN) {
            console.log('❌ [Demos] Неверный токен авторизации');
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        // 2. Извлечение заголовков от MatchZy
        const fileName = req.headers['matchzy-filename'];
        const matchId = req.headers['matchzy-matchid'];
        const mapNumber = req.headers['matchzy-mapnumber'];
        const roundNumber = req.headers['matchzy-roundnumber'];
        
        console.log('📋 [Demos] Заголовки:', {
            fileName,
            matchId,
            mapNumber,
            roundNumber
        });
        
        if (!matchId || !mapNumber) {
            console.log('❌ [Demos] Отсутствуют обязательные заголовки');
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required headers: MatchZy-MatchId, MatchZy-MapNumber' 
            });
        }
        
        // 3. Формирование имени файла (безопасное)
        const safeFileName = `${matchId}_map${mapNumber}.dem`;
        const filePath = path.join(DEMOS_DIR, safeFileName);
        
        console.log('💾 [Demos] Путь сохранения:', filePath);
        
        // 4. Получение бинарных данных
        const chunks = [];
        let totalSize = 0;
        
        req.on('data', (chunk) => {
            totalSize += chunk.length;
            
            // Проверка лимита размера
            if (totalSize > MAX_FILE_SIZE) {
                console.log(`❌ [Demos] Превышен лимит размера: ${totalSize} > ${MAX_FILE_SIZE}`);
                req.pause();
                req.socket.destroy();
                return;
            }
            
            chunks.push(chunk);
        });
        
        req.on('end', async () => {
            try {
                // Объединение чанков в буфер
                const buffer = Buffer.concat(chunks);
                
                console.log(`📦 [Demos] Получено ${buffer.length} байт`);
                
                // Сохранение файла
                fs.writeFileSync(filePath, buffer);
                
                console.log('✅ [Demos] Файл сохранен:', safeFileName);
                
                // 5. Обновление БД
                const relativePath = `uploads/demos/${safeFileName}`;
                
                const updateQuery = `
                    UPDATE matchzy_maps 
                    SET 
                        demo_file_path = $1,
                        demo_uploaded_at = NOW(),
                        demo_size_bytes = $2
                    WHERE matchid = $3 AND mapnumber = $4
                    RETURNING *
                `;
                
                const result = await pool.query(updateQuery, [
                    relativePath,
                    buffer.length,
                    parseInt(matchId),
                    parseInt(mapNumber)
                ]);
                
                if (result.rows.length === 0) {
                    console.log('⚠️ [Demos] Карта не найдена в БД, файл сохранен но не привязан');
                } else {
                    console.log('✅ [Demos] БД обновлена:', result.rows[0]);
                }
                
                // 6. Возврат успеха
                res.status(200).send('OK');
                
            } catch (err) {
                console.error('❌ [Demos] Ошибка при сохранении:', err);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to save demo file' 
                });
            }
        });
        
        req.on('error', (err) => {
            console.error('❌ [Demos] Ошибка при получении данных:', err);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to receive demo file' 
            });
        });
        
    } catch (error) {
        console.error('❌ [Demos] Непредвиденная ошибка:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

/**
 * GET /api/demos/download/:matchid/:mapnumber
 * Скачивание демки
 */
router.get('/download/:matchid/:mapnumber', async (req, res) => {
    const { matchid, mapnumber } = req.params;
    
    console.log(`📥 [Demos] Запрос на скачивание: matchid=${matchid}, map=${mapnumber}`);
    
    try {
        // 1. Поиск в БД
        const query = `
            SELECT demo_file_path, demo_size_bytes 
            FROM matchzy_maps 
            WHERE matchid = $1 AND mapnumber = $2 AND demo_file_path IS NOT NULL
        `;
        
        const result = await pool.query(query, [parseInt(matchid), parseInt(mapnumber)]);
        
        if (result.rows.length === 0) {
            console.log('❌ [Demos] Демка не найдена в БД');
            return res.status(404).json({ 
                success: false, 
                error: 'Demo not found' 
            });
        }
        
        const demoPath = result.rows[0].demo_file_path;
        const fullPath = path.join(__dirname, '..', demoPath);
        
        console.log('📂 [Demos] Путь к файлу:', fullPath);
        
        // 2. Проверка существования файла
        if (!fs.existsSync(fullPath)) {
            console.log('❌ [Demos] Файл не найден на диске');
            return res.status(404).json({ 
                success: false, 
                error: 'Demo file not found on disk' 
            });
        }
        
        // 3. Отправка файла
        const fileName = `match_${matchid}_map${mapnumber}.dem`;
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(res);
        
        console.log('✅ [Demos] Файл отправлен:', fileName);
        
    } catch (error) {
        console.error('❌ [Demos] Ошибка при скачивании:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to download demo' 
        });
    }
});

/**
 * GET /api/demos/available/:matchid
 * Проверка доступных демок для матча
 */
router.get('/available/:matchid', async (req, res) => {
    const { matchid } = req.params;
    
    try {
        const query = `
            SELECT mapnumber, demo_file_path, demo_uploaded_at, demo_size_bytes
            FROM matchzy_maps 
            WHERE matchid = $1 AND demo_file_path IS NOT NULL
            ORDER BY mapnumber
        `;
        
        const result = await pool.query(query, [parseInt(matchid)]);
        
        // Формируем объект { "1": true, "2": true, ... }
        const available = {};
        result.rows.forEach(row => {
            // Дополнительно проверяем существование файла на диске
            const fullPath = path.join(__dirname, '..', row.demo_file_path);
            if (fs.existsSync(fullPath)) {
                available[row.mapnumber] = {
                    available: true,
                    size: row.demo_size_bytes,
                    uploaded_at: row.demo_uploaded_at
                };
            }
        });
        
        res.json(available);
        
    } catch (error) {
        console.error('❌ [Demos] Ошибка при проверке демок:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to check available demos' 
        });
    }
});

/**
 * GET /api/demos/stats
 * Получение статистики по демкам (публичный эндпоинт)
 */
router.get('/stats', async (req, res) => {
    try {
        const { getDemosStats } = require('../services/demoCleanupService');
        const stats = await getDemosStats();
        
        if (!stats) {
            return res.status(500).json({
                success: false,
                error: 'Failed to get stats'
            });
        }
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ [Demos] Ошибка получения статистики:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get stats'
        });
    }
});

/**
 * POST /api/demos/cleanup
 * Ручной запуск очистки старых демок (только для админов)
 */
router.post('/cleanup', async (req, res) => {
    try {
        // Проверка авторизации (токен из заголовка)
        const authHeader = req.headers['authorization'];
        const token = authHeader?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        
        // Проверка прав администратора
        const jwt = require('jsonwebtoken');
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch (err) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
        
        // Проверка роли пользователя
        const userQuery = await pool.query(
            'SELECT role FROM users WHERE id = $1',
            [userId]
        );
        
        if (userQuery.rows.length === 0 || userQuery.rows[0].role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }
        
        // Запуск очистки
        console.log(`🗑️ [Demos] Ручной запуск очистки от пользователя ${userId}`);
        
        const { cleanupOldDemos } = require('../services/demoCleanupService');
        const stats = await cleanupOldDemos();
        
        res.json({
            success: true,
            message: 'Cleanup completed',
            stats: stats
        });
        
    } catch (error) {
        console.error('❌ [Demos] Ошибка ручной очистки:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup demos'
        });
    }
});

module.exports = router;

