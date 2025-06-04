const fs = require('fs');
const path = require('path');

// Путь к файлу
const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

console.log('🔧 РАДИКАЛЬНОЕ ИСПРАВЛЕНИЕ ЭКСПОРТА');
console.log('===================================');

try {
    // Читаем файл
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`📁 Файл загружен. Строк: ${lines.length}`);
    
    // Найдем последний </section>
    let sectionIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim() === '</section>') {
            sectionIndex = i;
            console.log(`🎯 Найден последний </section> на строке ${i + 1}`);
            break;
        }
    }
    
    if (sectionIndex === -1) {
        throw new Error('Не найден </section>');
    }
    
    // Создаем новый файл только до </section> + правильное окончание
    const newLines = lines.slice(0, sectionIndex + 1);
    
    // Добавляем только необходимое окончание
    newLines.push('    );');
    newLines.push('}');
    newLines.push('');
    newLines.push('export default TournamentDetails;');
    
    console.log(`📊 Обрезаем файл с ${lines.length} до ${newLines.length} строк`);
    
    // Проверяем баланс скобок
    const newContent = newLines.join('\n');
    const openBraces = (newContent.match(/\{/g) || []).length;
    const closeBraces = (newContent.match(/\}/g) || []).length;
    
    console.log(`📊 Открывающие скобки: ${openBraces}`);
    console.log(`📊 Закрывающие скобки: ${closeBraces}`);
    
    if (openBraces !== closeBraces) {
        const missing = openBraces - closeBraces;
        console.log(`🔧 Добавляем ${missing} недостающих скобок`);
        
        // Добавляем недостающие скобки перед export
        const exportIndex = newLines.length - 1;
        for (let i = 0; i < missing; i++) {
            newLines.splice(exportIndex, 0, '}');
        }
        
        // Обновляем содержимое
        const finalContent = newLines.join('\n');
        const finalOpenBraces = (finalContent.match(/\{/g) || []).length;
        const finalCloseBraces = (finalContent.match(/\}/g) || []).length;
        
        console.log(`📊 Финальный баланс: ${finalOpenBraces}:${finalCloseBraces}`);
        
        // Записываем файл
        fs.writeFileSync(filePath, finalContent, 'utf8');
    } else {
        console.log('✅ Баланс скобок уже идеальный');
        fs.writeFileSync(filePath, newContent, 'utf8');
    }
    
    console.log(`✅ Файл сохранен. Новое количество строк: ${newLines.length}`);
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

console.log('🎉 РАДИКАЛЬНОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!'); 