const fs = require('fs');

const FILE_PATH = 'frontend/src/components/TournamentDetails.js';

console.log('🚨 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: export default на неверхнем уровне');

function fixExportLevel() {
    try {
        let content = fs.readFileSync(FILE_PATH, 'utf8');
        
        console.log('📖 Файл загружен, размер:', Math.round(content.length / 1024), 'KB');
        
        // 1. ИСПРАВЛЕНИЕ: Убираем лишнюю закрывающую скобку перед export
        console.log('🔧 Исправление: Убираем лишнюю скобку перед export');
        
        // Ищем паттерн с лишней скобкой
        const wrongEndPattern = /(\s*<\/section>\s*\);\s*\}\s*)\}\s*(export default TournamentDetails;)/;
        
        if (content.match(wrongEndPattern)) {
            content = content.replace(wrongEndPattern, '$1\n\n$2');
            console.log('✅ Убрана лишняя закрывающая скобка перед export');
        } else {
            // Альтернативный поиск
            const altPattern = /(;\s*\}\s*)\}\s*(export default)/;
            if (content.match(altPattern)) {
                content = content.replace(altPattern, '$1\n\n$2');
                console.log('✅ Убрана лишняя скобка (альтернативный поиск)');
            } else {
                console.log('❓ Лишняя скобка не найдена, проверяем другие проблемы');
            }
        }
        
        // 2. ПРОВЕРКА: Убеждаемся, что export на верхнем уровне
        const lines = content.split('\n');
        const exportLineIndex = lines.findIndex(line => line.trim().startsWith('export default'));
        
        if (exportLineIndex !== -1) {
            // Проверяем, что перед export нет незакрытых блоков
            let braceBalance = 0;
            for (let i = 0; i < exportLineIndex; i++) {
                const line = lines[i];
                braceBalance += (line.match(/\{/g) || []).length;
                braceBalance -= (line.match(/\}/g) || []).length;
            }
            
            console.log(`Баланс скобок до export: ${braceBalance}`);
            
            if (braceBalance !== 0) {
                console.log(`⚠️ Найден дисбаланс скобок: ${braceBalance}`);
                
                if (braceBalance > 0) {
                    // Не хватает закрывающих скобок - добавляем перед export
                    const missingBraces = '}\n'.repeat(braceBalance);
                    lines.splice(exportLineIndex, 0, missingBraces);
                    content = lines.join('\n');
                    console.log(`✅ Добавлено ${braceBalance} закрывающих скобок перед export`);
                } else if (braceBalance < 0) {
                    // Слишком много закрывающих скобок - удаляем лишние
                    const excessBraces = Math.abs(braceBalance);
                    let removed = 0;
                    
                    for (let i = exportLineIndex - 1; i >= 0 && removed < excessBraces; i--) {
                        if (lines[i].trim() === '}') {
                            lines.splice(i, 1);
                            removed++;
                            exportLineIndex--; // Корректируем индекс
                        }
                    }
                    
                    content = lines.join('\n');
                    console.log(`✅ Удалено ${removed} лишних закрывающих скобок`);
                }
            }
        }
        
        // 3. ФИНАЛЬНАЯ ПРОВЕРКА: Убеждаемся в правильной структуре
        const finalLines = content.split('\n');
        const finalExportIndex = finalLines.findIndex(line => line.trim().startsWith('export default'));
        
        if (finalExportIndex !== -1) {
            // Проверяем предыдущие строки
            const beforeExport = finalLines.slice(Math.max(0, finalExportIndex - 3), finalExportIndex);
            console.log('📋 Строки перед export:');
            beforeExport.forEach((line, index) => {
                console.log(`   ${finalExportIndex - beforeExport.length + index + 1}: ${line.trim()}`);
            });
        }
        
        // Записываем исправленный файл
        fs.writeFileSync(FILE_PATH, content, 'utf8');
        
        // Финальная статистика
        const finalOpenBraces = (content.match(/\{/g) || []).length;
        const finalCloseBraces = (content.match(/\}/g) || []).length;
        
        console.log('✅ Файл исправлен!');
        console.log('📊 Финальная статистика:');
        console.log(`   - Размер файла: ${Math.round(content.length / 1024)} KB`);
        console.log(`   - Открывающих скобок: ${finalOpenBraces}`);
        console.log(`   - Закрывающих скобок: ${finalCloseBraces}`);
        console.log(`   - Баланс: ${finalOpenBraces === finalCloseBraces ? '✅ Сбалансированы' : '❌ Дисбаланс: ' + (finalOpenBraces - finalCloseBraces)}`);
        
        return finalOpenBraces === finalCloseBraces;
        
    } catch (error) {
        console.error('❌ Ошибка при исправлении export:', error);
        return false;
    }
}

// Запускаем исправление
if (fixExportLevel()) {
    console.log('\n🎯 УСПЕХ! export default теперь на верхнем уровне');
    console.log('🚀 Попробуйте запустить npm run build');
} else {
    console.log('\n❌ Не удалось полностью исправить проблему с export');
    console.log('🛠️ Возможно, требуется ручное исправление');
} 