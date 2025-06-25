#!/usr/bin/env node

/**
 * 🔧 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ ВСЕХ CSS ПРОБЛЕМ
 * Простой и эффективный подход
 */

const fs = require('fs');
const glob = require('glob');

console.log('🔧 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ CSS ПРОБЛЕМ');
console.log('='.repeat(50));

// Находим все CSS файлы
const files = glob.sync('frontend/src/components/**/*.css');

let totalFixed = 0;

files.forEach(filePath => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        let fixedCount = 0;
        
        console.log(`🔧 Проверяем: ${filePath}`);
        
        // Простое и универсальное исправление:
        // Заменяем все конструкции /* /* REMOVED ANIMATION: ... */ */ на /* REMOVED ANIMATION: ... */
        content = content.replace(/\/\* \/\* REMOVED ANIMATION: ([^*]+(?:\*[^\/])*)\*\/ \*\//g, (match, p1) => {
            fixedCount++;
            return `/* REMOVED ANIMATION: ${p1.trim()} */`;
        });
        
        // Также исправляем конструкции типа /* REMOVED ANIMATION: ... */ REMOVED ANIMATION: ... */
        content = content.replace(/\/\* REMOVED ANIMATION: ([^*]+) \*\/ REMOVED ANIMATION: ([^*]+(?:\*[^\/])*) \*\//g, (match, p1, p2) => {
            fixedCount++;
            return `/* REMOVED ANIMATION: ${p2.trim()} */`;
        });
        
        if (content !== originalContent) {
            // Создаем backup
            const backupPath = `${filePath}.final-backup.${Date.now()}`;
            fs.writeFileSync(backupPath, originalContent, 'utf8');
            
            // Сохраняем исправленный файл
            fs.writeFileSync(filePath, content, 'utf8');
            
            console.log(`✅ Исправлен: ${filePath}`);
            console.log(`📦 Backup: ${backupPath}`);
            console.log(`🎯 Исправлено: ${fixedCount}`);
            totalFixed += fixedCount;
        } else {
            console.log(`✅ Корректный: ${filePath}`);
        }
        
    } catch (error) {
        console.error(`❌ Ошибка: ${filePath}:`, error.message);
    }
});

console.log('='.repeat(50));
console.log(`✅ ЗАВЕРШЕНО! Всего исправлено: ${totalFixed}`); 