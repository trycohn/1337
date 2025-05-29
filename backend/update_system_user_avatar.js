const pool = require('./db');

/**
 * Скрипт для обновления аватара системного пользователя 1337community
 * Использует изображение backend/uploads/avatars/1337-logo-chat.png
 */
async function updateSystemUserAvatar() {
    try {
        console.log('🔄 Начинаем обновление аватара системного пользователя 1337community...');
        
        // Определяем URL аватара в зависимости от окружения
        const avatarUrl = process.env.NODE_ENV === 'production'
            ? 'https://1337community.com/uploads/avatars/1337-logo-chat.png'
            : 'http://localhost:3000/uploads/avatars/1337-logo-chat.png';
        
        // Проверяем, существует ли системный пользователь
        const userCheck = await pool.query('SELECT id, username, avatar_url FROM users WHERE username = $1', ['1337community']);
        
        if (userCheck.rows.length === 0) {
            console.log('⚠️ Системный пользователь 1337community не найден. Создаем...');
            
            // Создаем системного пользователя с аватаром
            const result = await pool.query(
                'INSERT INTO users (username, email, password_hash, is_verified, avatar_url, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, username, avatar_url',
                ['1337community', 'system@1337community.com', 'system_user_no_login', true, avatarUrl]
            );
            
            const newUser = result.rows[0];
            console.log(`✅ Создан системный пользователь:`);
            console.log(`   ID: ${newUser.id}`);
            console.log(`   Username: ${newUser.username}`);
            console.log(`   Avatar URL: ${newUser.avatar_url}`);
        } else {
            // Обновляем аватар существующего пользователя
            const existingUser = userCheck.rows[0];
            console.log(`📋 Найден существующий системный пользователь:`);
            console.log(`   ID: ${existingUser.id}`);
            console.log(`   Username: ${existingUser.username}`);
            console.log(`   Текущий Avatar URL: ${existingUser.avatar_url || 'не установлен'}`);
            
            await pool.query(
                'UPDATE users SET avatar_url = $1 WHERE username = $2',
                [avatarUrl, '1337community']
            );
            
            console.log(`✅ Аватар обновлен на: ${avatarUrl}`);
        }
        
        // Проверяем результат
        const updatedUser = await pool.query('SELECT id, username, avatar_url FROM users WHERE username = $1', ['1337community']);
        const user = updatedUser.rows[0];
        
        console.log('\n🎯 Итоговый результат:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Avatar URL: ${user.avatar_url}`);
        console.log('\n✅ Обновление аватара системного пользователя завершено успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка при обновлении аватара системного пользователя:', error);
        throw error;
    } finally {
        // Закрываем соединение с базой данных
        await pool.end();
    }
}

// Запускаем скрипт, если файл выполняется напрямую
if (require.main === module) {
    updateSystemUserAvatar()
        .then(() => {
            console.log('🏁 Скрипт завершен успешно');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Скрипт завершен с ошибкой:', error);
            process.exit(1);
        });
}

module.exports = { updateSystemUserAvatar }; 