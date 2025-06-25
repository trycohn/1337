#!/usr/bin/env node

/**
 * 🔧 Универсальный скрипт исправления всех CSS проблем
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 УНИВЕРСАЛЬНОЕ ИСПРАВЛЕНИЕ ВСЕХ CSS ПРОБЛЕМ');
console.log('='.repeat(50));

// Находим все CSS файлы в модальных окнах
const cssFiles = [
    'frontend/src/components/**/*.css',
    'frontend/src/components/tournament/**/*.css'
];

let totalFixed = 0;

cssFiles.forEach(pattern => {
    try {
        const files = glob.sync(pattern);
        
        files.forEach(filePath => {
            try {
                let content = fs.readFileSync(filePath, 'utf8');
                let originalContent = content;
                let fixedCount = 0;
                
                console.log(`🔧 Проверяем: ${filePath}`);
                
                // Паттерн 1: /* REMOVED ANIMATION: */ REMOVED ANIMATION: something; */
                const pattern1 = /\/\* REMOVED ANIMATION: \*\/ REMOVED ANIMATION: ([^}*]+); \*\//g;
                content = content.replace(pattern1, (match, p1) => {
                    fixedCount++;
                    return `/* REMOVED ANIMATION: ${p1.trim()}; */`;
                });
                
                // Паттерн 2: /* REMOVED ANIMATION: something */ */
                const pattern2 = /\/\* REMOVED ANIMATION: ([^*]+) \*\/ \*\//g;
                content = content.replace(pattern2, (match, p1) => {
                    fixedCount++;
                    return `/* REMOVED ANIMATION: ${p1.trim()} */`;
                });
                
                // Паттерн 3: множественные вложенные REMOVED ANIMATION
                const pattern3 = /\/\* REMOVED ANIMATION: \*\/ REMOVED ANIMATION: \/\* REMOVED ANIMATION: ([^}*]+) \*\/ \*\/ \*\//g;
                content = content.replace(pattern3, (match, p1) => {
                    fixedCount++;
                    return `/* REMOVED ANIMATION: ${p1.trim()} */`;
                });
                
                // Паттерн 4: REMOVED ANIMATION: без правильных комментариев
                const pattern4 = /REMOVED ANIMATION: ([^;]+);/g;
                content = content.replace(pattern4, (match, p1) => {
                    if (!match.includes('/*')) {
                        fixedCount++;
                        return `/* REMOVED ANIMATION: ${p1.trim()}; */`;
                    }
                    return match;
                });
                
                // Если были изменения, сохраняем файл
                if (content !== originalContent) {
                    // Создаем backup
                    const backupPath = `${filePath}.universal-fix-backup.${Date.now()}`;
                    fs.writeFileSync(backupPath, originalContent, 'utf8');
                    
                    // Сохраняем исправленный файл
                    fs.writeFileSync(filePath, content, 'utf8');
                    
                    console.log(`✅ Исправлен: ${filePath}`);
                    console.log(`📦 Backup: ${backupPath}`);
                    console.log(`🎯 Исправлено проблем: ${fixedCount}`);
                    totalFixed += fixedCount;
                } else {
                    console.log(`✅ Файл корректный: ${filePath}`);
                }
                
            } catch (error) {
                console.error(`❌ Ошибка при обработке ${filePath}:`, error.message);
            }
        });
        
    } catch (error) {
        console.error(`❌ Ошибка при поиске файлов по паттерну ${pattern}:`, error.message);
    }
});

console.log('='.repeat(50));
console.log(`✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!`);
console.log(`🎯 Всего исправлено проблем: ${totalFixed}`); 