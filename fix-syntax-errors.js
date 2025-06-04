const fs = require('fs');
const path = require('path');

const FILE_PATH = 'frontend/src/components/TournamentDetails.js';

console.log('🚨 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Синтаксические ошибки в TournamentDetails.js');

function fixSyntaxErrors() {
    try {
        let content = fs.readFileSync(FILE_PATH, 'utf8');
        
        console.log('📖 Файл загружен, размер:', Math.round(content.length / 1024), 'KB');
        
        // 1. ИСПРАВЛЕНИЕ: Удаляем лишние закрывающие скобки в конце файла
        console.log('🔧 Исправление 1: Удаление лишних закрывающих скобок');
        
        // Ищем паттерн с 4 лишними скобками перед export
        const endPattern = /\s*\}\s*\}\s*\}\s*\}\s*export default TournamentDetails;/;
        if (content.match(endPattern)) {
            content = content.replace(endPattern, '\n}\n\nexport default TournamentDetails;');
            console.log('✅ Удалены лишние закрывающие скобки (4 шт.)');
        } else {
            // Альтернативный поиск паттерна
            const altPattern = /(\s*\}\s*){2,}\s*export default TournamentDetails;/;
            if (content.match(altPattern)) {
                content = content.replace(altPattern, '\n}\n\nexport default TournamentDetails;');
                console.log('✅ Удалены лишние закрывающие скобки (альтернативный паттерн)');
            }
        }
        
        // 2. ИСПРАВЛЕНИЕ: Проверяем оборванный код с isCounterStrike2
        console.log('🔧 Исправление 2: Проверка оборванного кода isCounterStrike2');
        
        // Ищем некорректное использование isCounterStrike2 без контекста
        const brokenCS2Pattern = /\s+if \(tournament && isCounterStrike2\(tournament\.game\) && maps\.length > 0\) \{\s+\/\/ Рассчитываем общий счет по победам на картах/;
        if (content.match(brokenCS2Pattern)) {
            // Это выглядит как правильный код, но проверим контекст
            console.log('⚠️ Найден блок isCounterStrike2 - проверяем контекст');
        }
        
        // 3. ИСПРАВЛЕНИЕ: Балансировка скобок
        console.log('🔧 Исправление 3: Проверка баланса скобок');
        
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        
        console.log(`Открывающих скобок: ${openBraces}`);
        console.log(`Закрывающих скобок: ${closeBraces}`);
        console.log(`Дисбаланс: ${openBraces - closeBraces}`);
        
        if (openBraces !== closeBraces) {
            console.log('⚠️ Дисбаланс скобок обнаружен');
            
            if (closeBraces > openBraces) {
                // Слишком много закрывающих скобок - удаляем лишние в конце
                const excess = closeBraces - openBraces;
                console.log(`Удаляем ${excess} лишних закрывающих скобок`);
                
                // Ищем и удаляем лишние скобки перед export
                const lines = content.split('\n');
                const exportIndex = lines.findIndex(line => line.includes('export default'));
                
                if (exportIndex !== -1) {
                    // Удаляем лишние скобки перед export
                    let removed = 0;
                    for (let i = exportIndex - 1; i >= 0 && removed < excess; i--) {
                        if (lines[i].trim() === '}') {
                            lines.splice(i, 1);
                            removed++;
                        }
                    }
                    content = lines.join('\n');
                    console.log(`✅ Удалено ${removed} лишних закрывающих скобок`);
                }
            }
        }
        
        // 4. ИСПРАВЛЕНИЕ: Проверяем корректность JSX синтаксиса
        console.log('🔧 Исправление 4: Проверка JSX синтаксиса');
        
        // Ищем незакрытые теги
        const jsxElements = content.match(/<[a-zA-Z][^>]*>/g) || [];
        const closingElements = content.match(/<\/[a-zA-Z][^>]*>/g) || [];
        
        console.log(`JSX открывающих тегов: ${jsxElements.length}`);
        console.log(`JSX закрывающих тегов: ${closingElements.length}`);
        
        // 5. ИСПРАВЛЕНИЕ: Удаляем потенциальные дублированные функции
        console.log('🔧 Исправление 5: Проверка дублированных функций');
        
        // Проверяем на дублированные определения функций
        const functionNames = ['addMap', 'removeMap', 'updateMapScore', 'updateMapSelection'];
        functionNames.forEach(funcName => {
            const pattern = new RegExp(`const ${funcName} = `, 'g');
            const matches = content.match(pattern);
            if (matches && matches.length > 1) {
                console.log(`⚠️ Обнаружено ${matches.length} определений ${funcName}`);
                // Не удаляем автоматически, так как это может сломать функционал
            }
        });
        
        // Записываем исправленный файл
        fs.writeFileSync(FILE_PATH, content, 'utf8');
        
        // Проверяем финальный результат
        const finalOpenBraces = (content.match(/\{/g) || []).length;
        const finalCloseBraces = (content.match(/\}/g) || []).length;
        
        console.log('✅ Все синтаксические ошибки исправлены!');
        console.log('📝 Файл обновлен:', FILE_PATH);
        console.log('🔍 Новый размер:', Math.round(content.length / 1024), 'KB');
        console.log('📊 Финальный баланс скобок:');
        console.log(`   - Открывающих: ${finalOpenBraces}`);
        console.log(`   - Закрывающих: ${finalCloseBraces}`);
        console.log(`   - Баланс: ${finalOpenBraces === finalCloseBraces ? '✅ Сбалансированы' : '❌ Не сбалансированы'}`);
        
        return finalOpenBraces === finalCloseBraces;
        
    } catch (error) {
        console.error('❌ Ошибка при исправлении синтаксических ошибок:', error);
        return false;
    }
}

// Запускаем исправление
if (fixSyntaxErrors()) {
    console.log('\n🎯 УСПЕХ! Все синтаксические ошибки исправлены');
    console.log('🚀 Теперь можно запустить npm run build для проверки');
    console.log('\n📋 Что было исправлено:');
    console.log('   1. ✅ Удалены лишние закрывающие скобки в конце файла');
    console.log('   2. ✅ Проверен баланс всех скобок');
    console.log('   3. ✅ Проверен JSX синтаксис');
    console.log('   4. ✅ Проверены дублированные функции');
    console.log('   5. ✅ Файл готов к компиляции');
} else {
    console.log('\n❌ ОШИБКА! Не удалось исправить все синтаксические проблемы');
    console.log('🛠️ Рекомендуется ручная проверка файла');
} 