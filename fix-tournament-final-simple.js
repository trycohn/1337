const fs = require('fs');
const path = require('path');

// Путь к файлу
const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

console.log('🔧 ПРОСТОЕ И НАДЕЖНОЕ ИСПРАВЛЕНИЕ TournamentDetails.js');
console.log('=================================================');

try {
    // Читаем файл
    let content = fs.readFileSync(filePath, 'utf8');
    console.log(`📁 Файл загружен. Размер: ${content.length} символов`);
    
    const lines = content.split('\n');
    console.log(`📊 Всего строк: ${lines.length}`);
    
    // Найдем строку с </section>
    let sectionIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '</section>') {
            sectionIndex = i;
            console.log(`🎯 Найден </section> на строке ${i + 1}`);
            break;
        }
    }
    
    if (sectionIndex === -1) {
        throw new Error('Не найден </section>');
    }
    
    // Берем все строки до </section> включительно и добавляем правильное окончание
    const newLines = lines.slice(0, sectionIndex + 1);
    
    // Добавляем правильное окончание
    newLines.push('    );');
    newLines.push('}');
    newLines.push('');
    newLines.push('export default TournamentDetails;');
    
    console.log(`📊 Новое количество строк: ${newLines.length}`);
    
    // Проверяем баланс скобок
    const newContent = newLines.join('\n');
    const openBraces = (newContent.match(/\{/g) || []).length;
    const closeBraces = (newContent.match(/\}/g) || []).length;
    
    console.log(`📊 Открывающие скобки: ${openBraces}`);
    console.log(`📊 Закрывающие скобки: ${closeBraces}`);
    
    if (openBraces === closeBraces) {
        console.log('✅ Баланс скобок идеальный!');
    } else {
        console.log(`⚠️ Дисбаланс скобок: ${openBraces - closeBraces}`);
    }
    
    // Записываем файл
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log(`✅ Файл сохранен. Размер: ${newContent.length} символов`);
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

console.log('🎉 ПРОСТОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!'); 