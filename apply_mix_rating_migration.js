const pool = require('./backend/db');

async function applyMixRatingMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Применяем миграцию mix_rating_type...');
        
        // Проверяем, есть ли уже колонка
        const checkColumn = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tournaments' AND column_name = 'mix_rating_type'
        `);
        
        if (checkColumn.rows.length > 0) {
            console.log('✅ Колонка mix_rating_type уже существует');
            return;
        }
        
        // Добавляем колонку
        await client.query(`
            ALTER TABLE tournaments 
            ADD COLUMN mix_rating_type VARCHAR(20) DEFAULT 'faceit' 
            CHECK (mix_rating_type IN ('faceit', 'premier', 'mixed'))
        `);
        
        console.log('✅ Добавлена колонка mix_rating_type');
        
        // Добавляем комментарий
        await client.query(`
            COMMENT ON COLUMN tournaments.mix_rating_type IS 
            'Тип рейтинга для микс турниров: faceit, premier или mixed (без учета рейтинга)'
        `);
        
        console.log('✅ Добавлен комментарий к колонке');
        
        // Обновляем существующие микс турниры
        const updateResult = await client.query(`
            UPDATE tournaments 
            SET mix_rating_type = 'faceit' 
            WHERE format = 'mix' AND mix_rating_type IS NULL
        `);
        
        console.log(`✅ Обновлено ${updateResult.rowCount} микс турниров`);
        console.log('🎉 Миграция mix_rating_type успешно применена!');
        
    } catch (error) {
        console.error('❌ Ошибка при применении миграции:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Запускаем миграцию
applyMixRatingMigration()
    .then(() => {
        console.log('🎯 Миграция завершена успешно');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Миграция завершена с ошибкой:', error);
        process.exit(1);
    }); 