const pool = require('./db');

/**
 * Диагностический скрипт для проверки аватара системного пользователя 1337community
 * Проверяет все аспекты: пользователь, чаты, SQL запросы
 */
async function debugSystemAvatar() {
    try {
        console.log('🔍 ДИАГНОСТИКА АВАТАРА СИСТЕМНОГО ПОЛЬЗОВАТЕЛЯ 1337community');
        console.log('================================================================');
        
        // 1. Проверяем системного пользователя в базе данных
        console.log('\n1️⃣ Проверка системного пользователя в базе данных:');
        const userResult = await pool.query('SELECT id, username, email, avatar_url, created_at, updated_at FROM users WHERE username = $1', ['1337community']);
        
        if (userResult.rows.length === 0) {
            console.log('❌ Системный пользователь 1337community НЕ НАЙДЕН в базе данных!');
            return;
        }
        
        const user = userResult.rows[0];
        console.log('✅ Системный пользователь найден:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Avatar URL: ${user.avatar_url || 'НЕ УСТАНОВЛЕН'}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Updated: ${user.updated_at}`);
        
        // 2. Проверяем системные чаты
        console.log('\n2️⃣ Проверка системных чатов:');
        const chatsResult = await pool.query(`
            SELECT c.id, c.name, c.type, c.created_at, c.updated_at,
                   COUNT(cp.user_id) as participants_count
            FROM chats c
            LEFT JOIN chat_participants cp ON c.id = cp.chat_id
            WHERE c.name = '1337community' AND c.type = 'system'
            GROUP BY c.id, c.name, c.type, c.created_at, c.updated_at
        `);
        
        if (chatsResult.rows.length === 0) {
            console.log('⚠️ Системные чаты с именем "1337community" не найдены');
        } else {
            console.log(`✅ Найдено ${chatsResult.rows.length} системных чатов:`);
            chatsResult.rows.forEach((chat, index) => {
                console.log(`   Чат ${index + 1}:`);
                console.log(`     ID: ${chat.id}`);
                console.log(`     Name: ${chat.name}`);
                console.log(`     Type: ${chat.type}`);
                console.log(`     Participants: ${chat.participants_count}`);
                console.log(`     Created: ${chat.created_at}`);
                console.log(`     Updated: ${chat.updated_at}`);
            });
        }
        
        // 3. Тестируем SQL запрос для получения аватара в списке чатов
        console.log('\n3️⃣ Тестирование SQL запроса для списка чатов:');
        const testUserId = 1; // Тестируем с первым пользователем
        
        const chatListResult = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.type,
                CASE 
                    WHEN c.type = 'private' THEN (
                        SELECT u.avatar_url
                        FROM chat_participants cp2
                        JOIN users u ON cp2.user_id = u.id
                        WHERE cp2.chat_id = c.id AND cp2.user_id != $1
                        LIMIT 1
                    )
                    WHEN c.type = 'system' AND c.name = '1337community' THEN (
                        SELECT avatar_url FROM users WHERE username = '1337community' LIMIT 1
                    )
                    ELSE NULL
                END AS avatar_url
            FROM chats c
            JOIN chat_participants cp ON c.id = cp.chat_id
            WHERE cp.user_id = $1 AND c.name = '1337community' AND c.type = 'system'
        `, [testUserId]);
        
        if (chatListResult.rows.length === 0) {
            console.log('⚠️ Системные чаты для тестового пользователя не найдены');
        } else {
            console.log('✅ Результат SQL запроса для списка чатов:');
            chatListResult.rows.forEach((chat, index) => {
                console.log(`   Чат ${index + 1}:`);
                console.log(`     ID: ${chat.id}`);
                console.log(`     Name: ${chat.name}`);
                console.log(`     Type: ${chat.type}`);
                console.log(`     Avatar URL: ${chat.avatar_url || 'NULL'}`);
            });
        }
        
        // 4. Проверяем файл аватара
        console.log('\n4️⃣ Проверка файла аватара:');
        const fs = require('fs');
        const path = require('path');
        
        const avatarPath = path.join(__dirname, 'uploads/avatars/1337-logo-chat.png');
        const avatarExists = fs.existsSync(avatarPath);
        
        console.log(`   Путь к файлу: ${avatarPath}`);
        console.log(`   Файл существует: ${avatarExists ? '✅ ДА' : '❌ НЕТ'}`);
        
        if (avatarExists) {
            const stats = fs.statSync(avatarPath);
            console.log(`   Размер файла: ${stats.size} байт`);
            console.log(`   Дата изменения: ${stats.mtime}`);
        }
        
        // 5. Проверяем URL аватара в зависимости от окружения
        console.log('\n5️⃣ Проверка URL аватара:');
        const expectedAvatarUrl = process.env.NODE_ENV === 'production'
            ? 'https://1337community.com/uploads/avatars/1337-logo-chat.png'
            : 'http://localhost:3000/uploads/avatars/1337-logo-chat.png';
        
        console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'не установлен'}`);
        console.log(`   Ожидаемый URL: ${expectedAvatarUrl}`);
        console.log(`   Текущий URL в БД: ${user.avatar_url || 'не установлен'}`);
        console.log(`   URLs совпадают: ${user.avatar_url === expectedAvatarUrl ? '✅ ДА' : '❌ НЕТ'}`);
        
        // 6. Проверяем все пользователи с похожими именами
        console.log('\n6️⃣ Поиск пользователей с похожими именами:');
        const similarUsersResult = await pool.query(`
            SELECT id, username, email, avatar_url 
            FROM users 
            WHERE username ILIKE '%1337%' OR username ILIKE '%community%'
            ORDER BY username
        `);
        
        if (similarUsersResult.rows.length === 0) {
            console.log('⚠️ Пользователи с похожими именами не найдены');
        } else {
            console.log(`✅ Найдено ${similarUsersResult.rows.length} пользователей с похожими именами:`);
            similarUsersResult.rows.forEach((u, index) => {
                console.log(`   ${index + 1}. ID: ${u.id}, Username: ${u.username}, Avatar: ${u.avatar_url || 'не установлен'}`);
            });
        }
        
        // 7. Итоговая диагностика
        console.log('\n7️⃣ ИТОГОВАЯ ДИАГНОСТИКА:');
        const issues = [];
        
        if (!user.avatar_url) {
            issues.push('❌ Avatar URL не установлен в базе данных');
        } else if (user.avatar_url !== expectedAvatarUrl) {
            issues.push('❌ Avatar URL не соответствует ожидаемому');
        }
        
        if (!avatarExists) {
            issues.push('❌ Файл аватара не существует на диске');
        }
        
        if (chatsResult.rows.length === 0) {
            issues.push('❌ Системные чаты не найдены');
        }
        
        if (chatListResult.rows.length === 0) {
            issues.push('❌ SQL запрос не возвращает системные чаты');
        } else if (chatListResult.rows.some(chat => !chat.avatar_url)) {
            issues.push('❌ SQL запрос возвращает NULL для avatar_url');
        }
        
        if (issues.length === 0) {
            console.log('🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ! Аватар должен отображаться корректно.');
            console.log('\n📝 Рекомендации:');
            console.log('   1. Очистите кэш браузера (Ctrl+F5)');
            console.log('   2. Перезапустите сервер приложения');
            console.log('   3. Проверьте чат в режиме инкогнито');
        } else {
            console.log('🚨 ОБНАРУЖЕНЫ ПРОБЛЕМЫ:');
            issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue}`);
            });
        }
        
        console.log('\n================================================================');
        console.log('🏁 Диагностика завершена');
        
    } catch (error) {
        console.error('❌ Ошибка при диагностике:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Запускаем диагностику
if (require.main === module) {
    debugSystemAvatar()
        .then(() => {
            console.log('✅ Диагностика завершена успешно');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Диагностика завершена с ошибкой:', error);
            process.exit(1);
        });
}

module.exports = { debugSystemAvatar }; 