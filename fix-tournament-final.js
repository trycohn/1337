const fs = require('fs');
const path = require('path');

// Путь к файлу
const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

console.log('🔧 РАДИКАЛЬНОЕ ИСПРАВЛЕНИЕ TournamentDetails.js');
console.log('================================================');

try {
    // Читаем файл
    let content = fs.readFileSync(filePath, 'utf8');
    console.log(`📁 Файл загружен. Размер: ${content.length} символов`);
    
    // Найдем последний return в основной функции
    const lines = content.split('\n');
    console.log(`📊 Всего строк: ${lines.length}`);
    
    // Найдем закрывающую скобку после return (
    let foundReturn = false;
    let newLines = [];
    let inMainFunction = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Найдем функцию TournamentDetails
        if (line.includes('function TournamentDetails()')) {
            inMainFunction = true;
            braceCount = 0;
            console.log(`🎯 Найдена функция TournamentDetails на строке ${i + 1}`);
        }
        
        if (inMainFunction) {
            // Считаем скобки
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;
            braceCount += openBraces - closeBraces;
            
            // Если это возврат JSX
            if (line.trim().includes('</section>')) {
                foundReturn = true;
                console.log(`🎯 Найден </section> на строке ${i + 1}, braceCount: ${braceCount}`);
            }
            
            // Если это строка после return и braceCount = 1, то это закрытие функции
            if (foundReturn && line.trim() === ');' && braceCount === 1) {
                newLines.push(line);
                newLines.push('}'); // Закрываем функцию TournamentDetails
                newLines.push('');
                newLines.push('export default TournamentDetails;');
                console.log(`✅ Корректно закрываем функцию на строке ${i + 1}`);
                break; // Прекращаем обработку
            }
        }
        
        newLines.push(line);
    }
    
    // Записываем исправленный файл
    const newContent = newLines.join('\n');
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log(`✅ Файл исправлен. Новый размер: ${newContent.length} символов`);
    console.log(`📊 Строк в новом файле: ${newLines.length}`);
    
    // Проверяем баланс скобок
    const openBraces = (newContent.match(/\{/g) || []).length;
    const closeBraces = (newContent.match(/\}/g) || []).length;
    console.log(`📊 Открывающие скобки: ${openBraces}`);
    console.log(`📊 Закрывающие скобки: ${closeBraces}`);
    console.log(`📊 Баланс скобок: ${openBraces === closeBraces ? '✅ OK' : '❌ НЕПРАВИЛЬНО'}`);
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

console.log('🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!'); 