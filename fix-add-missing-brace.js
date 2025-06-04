const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'TournamentDetails.js');

console.log('🔧 ДОБАВЛЕНИЕ НЕДОСТАЮЩЕЙ СКОБКИ ФУНКЦИИ');
console.log('=========================================');

try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Проверяем текущее окончание файла
    const lines = content.split('\n');
    console.log(`📁 Файл имеет ${lines.length} строк`);
    console.log(`🔍 Последние 5 строк:`);
    
    const lastLines = lines.slice(-5);
    lastLines.forEach((line, index) => {
        const lineNum = lines.length - 5 + index + 1;
        console.log(`   ${lineNum}: "${line}"`);
    });
    
    // Проверяем, есть ли export в конце
    if (content.trim().endsWith('export default TournamentDetails;')) {
        console.log('✅ Export уже присутствует');
        
        // Добавляем недостающую скобку перед export
        const newContent = content.replace(
            /\s*export default TournamentDetails;$/,
            '\n}\n\nexport default TournamentDetails;'
        );
        
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('✅ Добавлена недостающая скобка перед export');
        
    } else {
        console.log('❌ Неожиданное окончание файла');
        
        // Добавляем правильное окончание
        const newContent = content + '\n}\n\nexport default TournamentDetails;\n';
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log('✅ Добавлено правильное окончание файла');
    }
    
    // Проверяем баланс скобок
    const updatedContent = fs.readFileSync(filePath, 'utf8');
    const openBraces = (updatedContent.match(/\{/g) || []).length;
    const closeBraces = (updatedContent.match(/\}/g) || []).length;
    
    console.log(`📊 Открывающие скобки: ${openBraces}`);
    console.log(`📊 Закрывающие скобки: ${closeBraces}`);
    console.log(`📊 Баланс: ${openBraces === closeBraces ? '✅ Сбалансированы' : '❌ Дисбаланс: ' + (openBraces - closeBraces)}`);
    
} catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
}

console.log('🎉 СКОБКА ДОБАВЛЕНА!'); 