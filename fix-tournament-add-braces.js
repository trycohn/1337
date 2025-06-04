const fs = require('fs');
const path = require('path');

// Путь к файлу
const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

console.log('🔧 ДОБАВЛЕНИЕ НЕДОСТАЮЩИХ СКОБОК');
console.log('================================');

try {
    // Читаем файл
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Подсчитываем скобки
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const missing = openBraces - closeBraces;
    
    console.log(`📊 Открывающие скобки: ${openBraces}`);
    console.log(`📊 Закрывающие скобки: ${closeBraces}`);
    console.log(`📊 Недостает: ${missing}`);
    
    if (missing > 0) {
        const lines = content.split('\n');
        
        // Находим строку с export
        let exportIndex = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].includes('export default TournamentDetails')) {
                exportIndex = i;
                break;
            }
        }
        
        if (exportIndex !== -1) {
            // Добавляем недостающие скобки перед export
            for (let i = 0; i < missing; i++) {
                lines.splice(exportIndex, 0, '}');
            }
            
            // Сохраняем файл
            const newContent = lines.join('\n');
            fs.writeFileSync(filePath, newContent, 'utf8');
            
            // Проверяем результат
            const finalOpenBraces = (newContent.match(/\{/g) || []).length;
            const finalCloseBraces = (newContent.match(/\}/g) || []).length;
            
            console.log(`✅ Добавлено ${missing} скобок`);
            console.log(`📊 Финальный баланс: ${finalOpenBraces}:${finalCloseBraces}`);
            console.log(`📊 Финальный размер: ${newContent.length} символов`);
            
        } else {
            console.log('❌ Не найден export default');
        }
    } else {
        console.log('✅ Скобки уже сбалансированы');
    }
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

console.log('🎉 ЗАВЕРШЕНО!'); 