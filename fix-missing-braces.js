const fs = require('fs');

const FILE_PATH = 'frontend/src/components/TournamentDetails.js';

console.log('🔧 ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ СКОБОК: Баланс скобок в TournamentDetails.js');

function addMissingBraces() {
    try {
        let content = fs.readFileSync(FILE_PATH, 'utf8');
        
        console.log('📖 Файл загружен, размер:', Math.round(content.length / 1024), 'KB');
        
        // Проверяем баланс скобок
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        const missingBraces = openBraces - closeBraces;
        
        console.log(`📊 Текущий баланс скобок:`);
        console.log(`   - Открывающих: ${openBraces}`);
        console.log(`   - Закрывающих: ${closeBraces}`);
        console.log(`   - Дисбаланс: ${missingBraces}`);
        
        if (missingBraces > 0) {
            console.log(`🔧 Добавляю ${missingBraces} недостающих закрывающих скобок`);
            
            // Находим позицию export
            const lines = content.split('\n');
            const exportIndex = lines.findIndex(line => line.trim().startsWith('export default'));
            
            if (exportIndex !== -1) {
                // Добавляем недостающие скобки перед export
                const missingBracesLines = Array(missingBraces).fill('}');
                lines.splice(exportIndex, 0, ...missingBracesLines, '');
                
                content = lines.join('\n');
                console.log(`✅ Добавлено ${missingBraces} закрывающих скобок перед export`);
            } else {
                // Если export не найден, добавляем в конец файла
                content += '\n' + '}\n'.repeat(missingBraces);
                console.log(`✅ Добавлено ${missingBraces} закрывающих скобок в конец файла`);
            }
        } else if (missingBraces < 0) {
            console.log(`⚠️ Слишком много закрывающих скобок: ${Math.abs(missingBraces)}`);
            return false;
        } else {
            console.log('✅ Скобки уже сбалансированы');
            return true;
        }
        
        // Записываем исправленный файл
        fs.writeFileSync(FILE_PATH, content, 'utf8');
        
        // Проверяем финальный результат
        const finalOpenBraces = (content.match(/\{/g) || []).length;
        const finalCloseBraces = (content.match(/\}/g) || []).length;
        
        console.log('📊 Финальная статистика:');
        console.log(`   - Размер файла: ${Math.round(content.length / 1024)} KB`);
        console.log(`   - Открывающих скобок: ${finalOpenBraces}`);
        console.log(`   - Закрывающих скобок: ${finalCloseBraces}`);
        console.log(`   - Баланс: ${finalOpenBraces === finalCloseBraces ? '✅ Идеально сбалансированы!' : '❌ Дисбаланс: ' + (finalOpenBraces - finalCloseBraces)}`);
        
        return finalOpenBraces === finalCloseBraces;
        
    } catch (error) {
        console.error('❌ Ошибка при добавлении недостающих скобок:', error);
        return false;
    }
}

// Запускаем исправление
if (addMissingBraces()) {
    console.log('\n🎯 УСПЕХ! Все скобки идеально сбалансированы');
    console.log('🚀 Теперь npm run build должен работать без синтаксических ошибок');
} else {
    console.log('\n❌ Не удалось полностью сбалансировать скобки');
} 