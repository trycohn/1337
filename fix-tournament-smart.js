const fs = require('fs');
const path = require('path');

// Путь к файлу
const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

console.log('🔧 УМНОЕ ИСПРАВЛЕНИЕ TournamentDetails.js');
console.log('==========================================');

try {
    // Читаем файл
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`📁 Файл загружен. Строк: ${lines.length}`);
    
    // Найдем функцию TournamentDetails
    let functionStart = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('function TournamentDetails()')) {
            functionStart = i;
            console.log(`🎯 Найдена функция TournamentDetails на строке ${i + 1}`);
            break;
        }
    }
    
    if (functionStart === -1) {
        throw new Error('Не найдена функция TournamentDetails');
    }
    
    // Найдем последний return в функции
    let lastReturnIndex = -1;
    for (let i = functionStart; i < lines.length; i++) {
        if (lines[i].trim().includes('return (')) {
            lastReturnIndex = i;
            console.log(`🎯 Найден return на строке ${i + 1}: "${lines[i].trim()}"`);
        }
    }
    
    if (lastReturnIndex === -1) {
        throw new Error('Не найден return в функции');
    }
    
    // Найдем соответствующий </section>
    let sectionIndex = -1;
    for (let i = lastReturnIndex; i < lines.length; i++) {
        if (lines[i].trim() === '</section>') {
            sectionIndex = i;
            console.log(`🎯 Найден </section> на строке ${i + 1}`);
            break;
        }
    }
    
    if (sectionIndex === -1) {
        throw new Error('Не найден </section> после return');
    }
    
    // Создаем правильное окончание функции
    const newLines = lines.slice(0, sectionIndex + 1);
    newLines.push('    );'); // Закрываем return (
    newLines.push('}');      // Закрываем function TournamentDetails() {
    newLines.push('');
    newLines.push('export default TournamentDetails;');
    
    const newContent = newLines.join('\n');
    
    // Проверяем баланс скобок
    const openBraces = (newContent.match(/\{/g) || []).length;
    const closeBraces = (newContent.match(/\}/g) || []).length;
    const openParens = (newContent.match(/\(/g) || []).length;
    const closeParens = (newContent.match(/\)/g) || []).length;
    
    console.log(`📊 Скобки { }: ${openBraces}:${closeBraces}`);
    console.log(`📊 Скобки ( ): ${openParens}:${closeParens}`);
    console.log(`📊 Строк в новом файле: ${newLines.length}`);
    
    // Записываем файл
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log(`✅ Файл сохранен. Размер: ${newContent.length} символов`);
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

console.log('🎉 УМНОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!'); 