const fs = require('fs');

const FILE_PATH = 'frontend/src/components/TournamentDetails.js';

console.log('🔧 Исправление дисбаланса скобок в TournamentDetails.js...');

function fixBraces() {
    try {
        let content = fs.readFileSync(FILE_PATH, 'utf8');
        console.log('📖 Файл загружен');
        
        // Подсчитываем скобки
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        
        console.log(`Открывающих скобок: ${openBraces}`);
        console.log(`Закрывающих скобок: ${closeBraces}`);
        console.log(`Дисбаланс: ${openBraces - closeBraces}`);
        
        if (openBraces === closeBraces) {
            console.log('✅ Скобки сбалансированы!');
            return true;
        }
        
        // Если не хватает закрывающих скобок, добавляем их в конец
        if (openBraces > closeBraces) {
            const missingBraces = openBraces - closeBraces;
            console.log(`⚠️ Не хватает ${missingBraces} закрывающих скобок`);
            
            // Находим последнюю функцию или компонент в файле
            const lines = content.split('\n');
            let lastNonEmptyLineIndex = lines.length - 1;
            
            // Ищем последнюю значимую строку
            while (lastNonEmptyLineIndex > 0 && !lines[lastNonEmptyLineIndex].trim()) {
                lastNonEmptyLineIndex--;
            }
            
            // Добавляем недостающие скобки перед последним export
            const exportIndex = content.lastIndexOf('export default');
            if (exportIndex !== -1) {
                const beforeExport = content.substring(0, exportIndex);
                const afterExport = content.substring(exportIndex);
                
                // Добавляем закрывающие скобки
                const missingCloseBraces = '}\n'.repeat(missingBraces);
                content = beforeExport + missingCloseBraces + afterExport;
                
                console.log(`✅ Добавлено ${missingBraces} закрывающих скобок перед export`);
            } else {
                // Если нет export, добавляем в конец файла
                const missingCloseBraces = '\n' + '}\n'.repeat(missingBraces);
                content += missingCloseBraces;
                
                console.log(`✅ Добавлено ${missingBraces} закрывающих скобок в конец файла`);
            }
        }
        
        // Если слишком много закрывающих скобок
        if (closeBraces > openBraces) {
            console.log(`⚠️ Слишком много закрывающих скобок: +${closeBraces - openBraces}`);
            console.log('Требуется ручное исправление');
            return false;
        }
        
        // Записываем исправленный файл
        fs.writeFileSync(FILE_PATH, content, 'utf8');
        
        // Проверяем результат
        const newOpenBraces = (content.match(/\{/g) || []).length;
        const newCloseBraces = (content.match(/\}/g) || []).length;
        
        console.log('📊 После исправления:');
        console.log(`Открывающих скобок: ${newOpenBraces}`);
        console.log(`Закрывающих скобок: ${newCloseBraces}`);
        console.log(`Баланс: ${newOpenBraces === newCloseBraces ? '✅ Сбалансированы' : '❌ Не сбалансированы'}`);
        
        return newOpenBraces === newCloseBraces;
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        return false;
    }
}

if (fixBraces()) {
    console.log('\n🎯 УСПЕХ! Скобки исправлены');
} else {
    console.log('\n❌ Не удалось исправить скобки автоматически');
} 