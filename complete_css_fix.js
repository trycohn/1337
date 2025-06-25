#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');

console.log('🔧 ПОЛНОЕ ИСПРАВЛЕНИЕ ВЛОЖЕННЫХ CSS КОММЕНТАРИЕВ');
console.log('='.repeat(50));

// Находим все CSS файлы
const files = glob.sync('frontend/src/components/**/*.css');

files.forEach(filePath => {
    console.log(`🔧 Обрабатываем: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // Backup
    const backupPath = `${filePath}.complete-fix-backup.${Date.now()}`;
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    
    // Исправляем все типы вложенных комментариев
    
    // Тип 1: /* /* REMOVED ANIMATION: ... */ */
    content = content.replace(/\/\* \/\* REMOVED ANIMATION: ([^*]+(?:\*(?!\/)[^*]*)*) \*\/ \*\//g, '/* REMOVED ANIMATION: $1 */');
    
    // Тип 2: /* REMOVED ANIMATION: */ REMOVED ANIMATION: /* REMOVED ANIMATION: ... */
    content = content.replace(/\/\* REMOVED ANIMATION: \*\/ REMOVED ANIMATION: \/\* REMOVED ANIMATION: ([^*]+(?:\*(?!\/)[^*]*)*) \*\//g, '/* REMOVED ANIMATION: $1 */');
    
    // Тип 3: Множественные */ */
    content = content.replace(/\*\/ \*\//g, '*/');
    
    // Тип 4: Открытые комментарии без закрытия
    content = content.replace(/\/\* \/\* REMOVED ANIMATION: ([^*]+)\s*$/gm, '/* REMOVED ANIMATION: $1 */');
    
    // Сохраняем файл
    fs.writeFileSync(filePath, content, 'utf8');
    
    if (content !== originalContent) {
        console.log(`✅ Исправлен: ${filePath}`);
        console.log(`📦 Backup: ${backupPath}`);
    } else {
        console.log(`✅ Корректный: ${filePath}`);
        // Удаляем backup если изменений не было
        fs.unlinkSync(backupPath);
    }
});

console.log('✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!'); 