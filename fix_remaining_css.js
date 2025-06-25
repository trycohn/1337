#!/usr/bin/env node

/**
 * 🔧 Скрипт исправления оставшихся CSS проблем
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 ИСПРАВЛЕНИЕ ОСТАВШИХСЯ CSS ПРОБЛЕМ');
console.log('='.repeat(50));

const filePath = 'frontend/src/components/tournament/modals/AddParticipantModal.css';

try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    console.log(`🔧 Обрабатываем: ${filePath}`);
    
    // Создаем backup
    const backupPath = `${filePath}.final-fix-backup.${Date.now()}`;
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log(`📦 Backup: ${backupPath}`);
    
    // Исправляем все проблемные паттерны
    let fixedCount = 0;
    
    // Паттерн 1: /* REMOVED ANIMATION: */ REMOVED ANIMATION: something; */
    const pattern1 = /\/\* REMOVED ANIMATION: \*\/ REMOVED ANIMATION: ([^}]+); \*\//g;
    content = content.replace(pattern1, (match, p1) => {
        fixedCount++;
        return `/* REMOVED ANIMATION: ${p1}; */`;
    });
    
    // Паттерн 2: любые другие вложенные конструкции
    const pattern2 = /\/\* REMOVED ANIMATION: ([^*\/]+) \*\/ \*\//g;
    content = content.replace(pattern2, (match, p1) => {
        fixedCount++;
        return `/* REMOVED ANIMATION: ${p1} */`;
    });
    
    // Записываем исправленный файл
    fs.writeFileSync(filePath, content, 'utf8');
    
    if (fixedCount > 0) {
        console.log(`✅ Исправлен: ${filePath}`);
        console.log(`🎯 Исправлено проблем: ${fixedCount}`);
    } else {
        console.log(`✅ Файл уже корректный: ${filePath}`);
    }
    
} catch (error) {
    console.error(`❌ Ошибка при обработке ${filePath}:`, error.message);
}

console.log('✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!'); 