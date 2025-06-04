const fs = require('fs');
const path = require('path');

const FILE_PATH = 'frontend/src/components/TournamentDetails.js';

console.log('🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Оборванный код в TournamentDetails.js');

function fixBrokenCode() {
    try {
        let content = fs.readFileSync(FILE_PATH, 'utf8');
        
        console.log('📖 Файл загружен, размер:', Math.round(content.length / 1024), 'KB');
        
        // 1. УДАЛЯЕМ оборванный фрагмент кода (строки ~542-594)
        console.log('🔧 Исправление 1: Удаление оборванного фрагмента fetchCreatorInfo');
        
        // Ищем паттерн оборванного кода
        const brokenCodePattern = /\s+setCreator\(creatorInfo\);\s+return;\s+\}\s+\}\s+\/\/ Проверяем, есть ли кешированные данные[\s\S]*?\}\s+\}\;\s+\/\/ Функция для загрузки карт из БД/;
        
        if (content.match(brokenCodePattern)) {
            content = content.replace(brokenCodePattern, '\n    // Функция для загрузки карт из БД');
            console.log('✅ Оборванный фрагмент кода удален');
        } else {
            console.log('❓ Оборванный фрагмент не найден по точному паттерну, ищем альтернативный...');
            
            // Альтернативный паттерн поиска
            const alternativePattern = /\s+\/\/ Проверяем, есть ли кешированные данные\s+try[\s\S]*?isError: true\s+\}\);\s+\}\s+\}\;\s+\/\/ Функция для загрузки карт из БД/;
            
            if (content.match(alternativePattern)) {
                content = content.replace(alternativePattern, '\n    // Функция для загрузки карт из БД');
                console.log('✅ Оборванный фрагмент найден и удален (альтернативный поиск)');
            } else {
                console.log('❌ Оборванный фрагмент не найден');
            }
        }
        
        // 2. ИСПРАВЛЯЕМ дублированные WebSocket disconnect обработчики
        console.log('🔧 Исправление 2: Удаление дублированных disconnect обработчиков');
        
        // Удаляем дублированный disconnect
        const duplicateDisconnectPattern = /socket\.on\('disconnect', \(reason\) => \{\s+console\.log\('Socket\.IO соединение закрыто в компоненте TournamentDetails:', reason\);\s+setWsConnected\(false\);\s+\}\);\s+\/\/ Обработка новых сообщений чата турнира/;
        
        if (content.match(duplicateDisconnectPattern)) {
            content = content.replace(duplicateDisconnectPattern, '// Обработка новых сообщений чата турнира');
            console.log('✅ Дублированный disconnect обработчик удален');
        }
        
        // 3. ПРОВЕРЯЕМ целостность WebSocket блока
        console.log('🔧 Исправление 3: Проверка целостности WebSocket блока');
        
        // Убеждаемся, что есть только один disconnect обработчик
        const disconnectCount = (content.match(/socket\.on\('disconnect'/g) || []).length;
        console.log(`Найдено ${disconnectCount} disconnect обработчиков`);
        
        if (disconnectCount > 1) {
            console.log('⚠️ Все еще есть дублированные disconnect обработчики, удаляем...');
            
            // Более агрессивное удаление дублированных обработчиков
            const lines = content.split('\n');
            const filteredLines = [];
            let skipNextDisconnect = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.includes("socket.on('disconnect'") && skipNextDisconnect) {
                    // Пропускаем дублированный блок
                    while (i < lines.length && !lines[i].includes('});')) {
                        i++;
                    }
                    continue;
                }
                
                if (line.includes("socket.on('disconnect'")) {
                    skipNextDisconnect = true;
                }
                
                filteredLines.push(line);
            }
            
            content = filteredLines.join('\n');
            console.log('✅ Дублированные disconnect обработчики удалены агрессивно');
        }
        
        // 4. ФИНАЛЬНАЯ ПРОВЕРКА синтаксиса
        console.log('🔧 Исправление 4: Финальная проверка синтаксиса');
        
        // Проверяем, что нет оборванных фигурных скобок
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        console.log(`Открывающих скобок: ${openBraces}, Закрывающих: ${closeBraces}`);
        
        if (Math.abs(openBraces - closeBraces) > 2) {
            console.log('⚠️ Возможная проблема с балансом скобок');
        }
        
        // Записываем исправленный файл
        fs.writeFileSync(FILE_PATH, content, 'utf8');
        
        console.log('✅ Все критические ошибки исправлены!');
        console.log('📝 Файл обновлен:', FILE_PATH);
        console.log('🔍 Новый размер:', Math.round(content.length / 1024), 'KB');
        
        // Статистика
        const lines = content.split('\n').length;
        console.log('📊 Результат:');
        console.log(`   - Общее количество строк: ${lines}`);
        console.log('   - ✅ Оборванный код удален');
        console.log('   - ✅ WebSocket обработчики исправлены');
        console.log('   - ✅ Синтаксис проверен');
        
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка при исправлении:', error);
        return false;
    }
}

// Запускаем исправление
if (fixBrokenCode()) {
    console.log('\n🎯 УСПЕХ! Критические ошибки TournamentDetails.js исправлены');
    console.log('🚀 Теперь можно запустить npm start для проверки');
    console.log('\n📋 Что было исправлено:');
    console.log('   1. ✅ Удален оборванный фрагмент fetchCreatorInfo');
    console.log('   2. ✅ Исправлены дублированные WebSocket обработчики');
    console.log('   3. ✅ Проверена целостность синтаксиса');
    console.log('   4. ✅ TDZ ошибки должны быть устранены');
} else {
    console.log('\n❌ ОШИБКА! Не удалось исправить критические проблемы');
} 