/**
 * 🗑️ DEMO CLEANUP SERVICE
 * Автоматическая очистка демо-файлов старше 7 дней
 * 
 * @version 1.0.0
 * @date 2025-10-10
 */

const fs = require('fs');
const path = require('path');
const pool = require('../db');

// Директория с демками
const DEMOS_DIR = path.join(__dirname, '../uploads/demos');

/**
 * Очистка демок старше 7 дней
 * @returns {Object} Статистика очистки
 */
async function cleanupOldDemos() {
    console.log('🗑️ [DemoCleanup] Запуск очистки старых демок...');
    
    const stats = {
        checked: 0,
        deleted: 0,
        errors: 0,
        freedSpace: 0,
        timestamp: new Date().toISOString()
    };
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Поиск демок старше 7 дней
        const query = `
            SELECT matchid, mapnumber, demo_file_path, demo_size_bytes, demo_uploaded_at
            FROM matchzy_maps 
            WHERE demo_uploaded_at < NOW() - INTERVAL '7 days'
              AND demo_file_path IS NOT NULL
            ORDER BY demo_uploaded_at ASC
        `;
        
        const result = await client.query(query);
        stats.checked = result.rows.length;
        
        console.log(`📊 [DemoCleanup] Найдено ${stats.checked} демок старше 7 дней`);
        
        if (stats.checked === 0) {
            await client.query('COMMIT');
            console.log('✅ [DemoCleanup] Нет демок для удаления');
            return stats;
        }
        
        // 2. Удаление каждой демки
        for (const row of result.rows) {
            try {
                const fullPath = path.join(__dirname, '..', row.demo_file_path);
                
                // Проверка существования файла
                if (fs.existsSync(fullPath)) {
                    // Удаление файла
                    fs.unlinkSync(fullPath);
                    stats.freedSpace += row.demo_size_bytes || 0;
                    console.log(`🗑️ [DemoCleanup] Удален файл: ${row.demo_file_path} (${formatBytes(row.demo_size_bytes)})`);
                } else {
                    console.log(`⚠️ [DemoCleanup] Файл не найден (уже удален?): ${row.demo_file_path}`);
                }
                
                // 3. Обновление БД (обнуляем поля)
                const updateQuery = `
                    UPDATE matchzy_maps 
                    SET 
                        demo_file_path = NULL,
                        demo_uploaded_at = NULL,
                        demo_size_bytes = NULL
                    WHERE matchid = $1 AND mapnumber = $2
                `;
                
                await client.query(updateQuery, [row.matchid, row.mapnumber]);
                
                stats.deleted++;
                
                console.log(`✅ [DemoCleanup] БД обновлена для matchid=${row.matchid}, map=${row.mapnumber}`);
                
            } catch (err) {
                stats.errors++;
                console.error(`❌ [DemoCleanup] Ошибка при удалении демки matchid=${row.matchid}, map=${row.mapnumber}:`, err.message);
                // Продолжаем работу даже при ошибке
            }
        }
        
        await client.query('COMMIT');
        
        // 4. Итоговая статистика
        console.log('═══════════════════════════════════════');
        console.log('📊 [DemoCleanup] Очистка завершена:');
        console.log(`   Проверено: ${stats.checked}`);
        console.log(`   Удалено: ${stats.deleted}`);
        console.log(`   Ошибок: ${stats.errors}`);
        console.log(`   Освобождено места: ${formatBytes(stats.freedSpace)}`);
        console.log('═══════════════════════════════════════');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [DemoCleanup] Критическая ошибка:', error);
        stats.errors++;
        throw error;
    } finally {
        client.release();
    }
    
    return stats;
}

/**
 * Форматирование размера в читаемый вид
 */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Получение статистики по демкам
 * @returns {Object} Статистика
 */
async function getDemosStats() {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_demos,
                SUM(demo_size_bytes) as total_size,
                COUNT(CASE WHEN demo_uploaded_at < NOW() - INTERVAL '7 days' THEN 1 END) as old_demos,
                SUM(CASE WHEN demo_uploaded_at < NOW() - INTERVAL '7 days' THEN demo_size_bytes ELSE 0 END) as old_size
            FROM matchzy_maps
            WHERE demo_file_path IS NOT NULL
        `;
        
        const result = await pool.query(query);
        const row = result.rows[0];
        
        return {
            total_demos: parseInt(row.total_demos) || 0,
            total_size: parseInt(row.total_size) || 0,
            total_size_formatted: formatBytes(row.total_size),
            old_demos: parseInt(row.old_demos) || 0,
            old_size: parseInt(row.old_size) || 0,
            old_size_formatted: formatBytes(row.old_size)
        };
    } catch (error) {
        console.error('❌ [DemoCleanup] Ошибка получения статистики:', error);
        return null;
    }
}

module.exports = {
    cleanupOldDemos,
    getDemosStats,
    formatBytes
};

