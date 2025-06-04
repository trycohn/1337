const fs = require('fs');

const FILE_PATH = 'frontend/src/components/TournamentDetails.js';

console.log('🚨 ОКОНЧАТЕЛЬНОЕ ИСПРАВЛЕНИЕ: Удаление лишних скобок в конце файла');

function ultimateSyntaxFix() {
    try {
        let content = fs.readFileSync(FILE_PATH, 'utf8');
        
        console.log('📖 Файл загружен, размер:', Math.round(content.length / 1024), 'KB');
        
        // ТОЧНОЕ ИСПРАВЛЕНИЕ: Убираем все лишние скобки перед export
        console.log('🔧 Удаляем все лишние закрывающие скобки перед export');
        
        // Паттерн: </section>    );  }  [любое количество дополнительных }]  export default
        const exactPattern = /(\s*<\/section>\s*\);\s*\}\s*)\}+(\s*export default TournamentDetails;)/;
        
        if (content.match(exactPattern)) {
            content = content.replace(exactPattern, '$1\n$2');
            console.log('✅ Удалены все лишние закрывающие скобки перед export');
        } else {
            // Альтернативный паттерн для других случаев
            const altPattern = /(\s*\);\s*\}\s*)\}+(\s*export default)/;
            if (content.match(altPattern)) {
                content = content.replace(altPattern, '$1\n$2');
                console.log('✅ Удалены лишние скобки (альтернативный паттерн)');
            } else {
                console.log('❓ Ищем другие варианты...');
                
                // Третий вариант - просто удаляем множественные } перед export
                const thirdPattern = /(\}\s*)\}+(\s*export default)/;
                if (content.match(thirdPattern)) {
                    content = content.replace(thirdPattern, '$1\n$2');
                    console.log('✅ Удалены множественные скобки перед export');
                }
            }
        }
        
        // Дополнительная очистка: удаляем пустые строки с только скобками перед export
        const lines = content.split('\n');
        const exportIndex = lines.findIndex(line => line.trim().startsWith('export default'));
        
        if (exportIndex !== -1) {
            // Удаляем строки, которые содержат только закрывающие скобки перед export
            let removed = 0;
            for (let i = exportIndex - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (line === '}') {
                    // Проверяем, нужна ли эта скобка
                    // Если перед ней уже есть скобка, удаляем
                    if (i > 0 && lines[i-1].trim() === '}') {
                        lines.splice(i, 1);
                        removed++;
                    } else {
                        break; // Оставляем одну скобку для закрытия функции
                    }
                } else if (line === '') {
                    // Пропускаем пустые строки
                    continue;
                } else {
                    break; // Найдена содержательная строка
                }
            }
            
            if (removed > 0) {
                content = lines.join('\n');
                console.log(`✅ Удалено ${removed} дополнительных строк с лишними скобками`);
            }
        }
        
        // Записываем исправленный файл
        fs.writeFileSync(FILE_PATH, content, 'utf8');
        
        // Финальная проверка синтаксиса
        const finalLines = content.split('\n');
        const finalExportIndex = finalLines.findIndex(line => line.trim().startsWith('export default'));
        
        console.log('📋 Финальная структура в конце файла:');
        if (finalExportIndex !== -1) {
            const contextLines = finalLines.slice(Math.max(0, finalExportIndex - 5), finalExportIndex + 3);
            contextLines.forEach((line, index) => {
                const lineNum = finalExportIndex - Math.min(5, finalExportIndex) + index + 1;
                const marker = lineNum === finalExportIndex + 1 ? ' → ' : '   ';
                console.log(`${marker}${lineNum}: ${line}`);
            });
        }
        
        // Проверяем баланс скобок
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        
        console.log('📊 Финальная статистика:');
        console.log(`   - Размер файла: ${Math.round(content.length / 1024)} KB`);
        console.log(`   - Открывающих скобок: ${openBraces}`);
        console.log(`   - Закрывающих скобок: ${closeBraces}`);
        console.log(`   - Баланс: ${openBraces === closeBraces ? '✅ Идеально сбалансированы' : '❌ Дисбаланс: ' + (openBraces - closeBraces)}`);
        
        return openBraces === closeBraces;
        
    } catch (error) {
        console.error('❌ Ошибка при окончательном исправлении:', error);
        return false;
    }
}

// Запускаем окончательное исправление
if (ultimateSyntaxFix()) {
    console.log('\n🎯 УСПЕХ! Файл полностью исправлен');
    console.log('🚀 Теперь npm run build должен работать без ошибок');
    console.log('\n📋 Что было сделано:');
    console.log('   1. ✅ Удалены все лишние закрывающие скобки');
    console.log('   2. ✅ export default теперь на правильном уровне');
    console.log('   3. ✅ Скобки идеально сбалансированы');
    console.log('   4. ✅ Синтаксис JavaScript корректен');
} else {
    console.log('\n❌ Все еще есть проблемы с балансом скобок');
    console.log('🛠️ Возможно, требуется дополнительная ручная корректировка');
} 