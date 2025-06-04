const fs = require('fs');
const path = require('path');

// Путь к файлу
const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

console.log('🔧 ОКОНЧАТЕЛЬНОЕ ИСПРАВЛЕНИЕ TournamentDetails.js');
console.log('===============================================');

try {
    // Читаем файл
    let content = fs.readFileSync(filePath, 'utf8');
    console.log(`📁 Файл загружен. Размер: ${content.length} символов`);
    
    const lines = content.split('\n');
    console.log(`📊 Всего строк: ${lines.length}`);
    
    // Найдем строку с </section>
    let sectionLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().includes('</section>')) {
            sectionLineIndex = i;
            console.log(`🎯 Найден </section> на строке ${i + 1}: "${lines[i].trim()}"`);
            break;
        }
    }
    
    if (sectionLineIndex === -1) {
        throw new Error('Не найден </section>');
    }
    
    // Найдем следующую строку после </section> с ); 
    let returnLineIndex = -1;
    for (let i = sectionLineIndex + 1; i < lines.length && i < sectionLineIndex + 5; i++) {
        if (lines[i].trim() === ');') {
            returnLineIndex = i;
            console.log(`🎯 Найден ); на строке ${i + 1}`);
            break;
        }
    }
    
    if (returnLineIndex === -1) {
        throw new Error('Не найден ); после </section>');
    }
    
    // Обрезаем файл до строки с );, добавляем правильное окончание
    const newLines = lines.slice(0, returnLineIndex + 1);
    
    // Добавляем недостающие закрывающие скобки и правильное окончание
    newLines.push('}'); // Закрываем функцию TournamentDetails
    newLines.push('');
    newLines.push('export default TournamentDetails;');
    
    console.log(`📊 Обрезаем файл с ${lines.length} до ${newLines.length} строк`);
    
    // Проверяем баланс скобок в новом содержимом
    const newContent = newLines.join('\n');
    const openBraces = (newContent.match(/\{/g) || []).length;
    const closeBraces = (newContent.match(/\}/g) || []).length;
    
    console.log(`📊 Открывающие скобки: ${openBraces}`);
    console.log(`📊 Закрывающие скобки: ${closeBraces}`);
    console.log(`📊 Разница: ${openBraces - closeBraces}`);
    
    // Если все еще есть дисбаланс, добавляем недостающие скобки
    const missingBraces = openBraces - closeBraces;
    if (missingBraces > 0) {
        console.log(`🔧 Добавляем ${missingBraces} недостающих закрывающих скобок`);
        
        // Вставляем недостающие скобки перед export
        const exportIndex = newLines.length - 1; // Индекс строки с export
        
        for (let i = 0; i < missingBraces; i++) {
            newLines.splice(exportIndex, 0, '}');
        }
    }
    
    // Финальная проверка
    const finalContent = newLines.join('\n');
    const finalOpenBraces = (finalContent.match(/\{/g) || []).length;
    const finalCloseBraces = (finalContent.match(/\}/g) || []).length;
    
    console.log(`📊 ФИНАЛЬНЫЙ БАЛАНС:`);
    console.log(`📊 Открывающие скобки: ${finalOpenBraces}`);
    console.log(`📊 Закрывающие скобки: ${finalCloseBraces}`);
    console.log(`📊 Баланс: ${finalOpenBraces === finalCloseBraces ? '✅ ИДЕАЛЬНЫЙ' : '❌ НЕПРАВИЛЬНЫЙ'}`);
    
    // Записываем исправленный файл
    fs.writeFileSync(filePath, finalContent, 'utf8');
    
    console.log(`✅ Файл исправлен и сохранен`);
    console.log(`📊 Финальный размер: ${finalContent.length} символов`);
    console.log(`📊 Финальное количество строк: ${newLines.length}`);
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

console.log('🎉 ОКОНЧАТЕЛЬНОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!'); 