#!/usr/bin/env node

/**
 * 🔧 Скрипт исправления вложенных CSS комментариев
 * 
 * Проблема: При удалении анимаций были созданы вложенные комментарии
 * Решение: Убираем вложенность, оставляя только корректные комментарии
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 ИСПРАВЛЕНИЕ ВЛОЖЕННЫХ CSS КОММЕНТАРИЕВ');
console.log('='.repeat(50));

// Список файлов для исправления
const cssFiles = [
    'frontend/src/components/modals/TeamModal.css',
    'frontend/src/components/tournament/modals/MatchResultModal.css',
    'frontend/src/components/styles/ParticipantsModal.css',
    'frontend/src/components/tournament/modals/MatchDetailsModal.css',
    'frontend/src/components/modals/TeamSelectionModal.css',
    'frontend/src/components/tournament/modals/ParticipantSearchModal.css',
    'frontend/src/components/tournament/modals/ParticipationConfirmModal.css',
    'frontend/src/components/AttachmentModal.css',
    'frontend/src/components/modals/CreateTeamModal.css',
    'frontend/src/components/tournament/modals/AddParticipantModal.css',
    'frontend/src/components/tournament/modals/ThirdPlaceMatchModal.css'
];

// Функция исправления вложенных комментариев
function fixNestedComments(content) {
    let fixed = content;
    
    // Паттерн для поиска вложенных комментариев
    const nestedCommentPattern = /\/\*\s*REMOVED ANIMATION:\s*(\/\*.*?\*\/\s*)+/g;
    
    // Заменяем вложенные комментарии на простые
    fixed = fixed.replace(nestedCommentPattern, (match) => {
        // Извлекаем самый внутренний комментарий
        const innerContent = match.match(/\/\*\s*REMOVED ANIMATION:\s*(.+?)\s*\*\//);
        if (innerContent && innerContent[1]) {
            // Убираем все вложенные части
            const cleanContent = innerContent[1]
                .replace(/\/\*.*?\*\//g, '') // Убираем все внутренние комментарии
                .replace(/\s+/g, ' ')        // Нормализуем пробелы
                .trim();
            
            if (cleanContent) {
                return `/* REMOVED ANIMATION: ${cleanContent} */`;
            }
        }
        return '/* REMOVED ANIMATION: [nested comment cleaned] */';
    });
    
    // Исправляем специфические случаи с text-transform
    fixed = fixed.replace(/text-\/\*\s*REMOVED ANIMATION:.*?\*\//g, '/* REMOVED ANIMATION: text-transform: uppercase; */');
    
    // Убираем остатки некорректных конструкций
    fixed = fixed.replace(/\/\*\s*REMOVED ANIMATION:\s*\/\*/g, '/* REMOVED ANIMATION: */');
    fixed = fixed.replace(/\*\/\s*\*\//g, '*/');
    
    return fixed;
}

// Обработка файлов
let fixedCount = 0;
let totalFixed = 0;

cssFiles.forEach(filePath => {
    console.log(`\n🔧 Обрабатываем: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ Файл не найден: ${filePath}`);
        return;
    }
    
    try {
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const fixedContent = fixNestedComments(originalContent);
        
        if (originalContent !== fixedContent) {
            // Создаем backup
            const backupPath = `${filePath}.nested-comments-backup.${Date.now()}`;
            fs.writeFileSync(backupPath, originalContent, 'utf8');
            
            // Записываем исправленную версию
            fs.writeFileSync(filePath, fixedContent, 'utf8');
            
            console.log(`✅ Исправлен: ${filePath}`);
            console.log(`📦 Backup: ${backupPath}`);
            fixedCount++;
            
            // Подсчитываем количество исправлений
            const beforeMatches = (originalContent.match(/\/\*\s*REMOVED ANIMATION:.*?\/\*.*?\*\//g) || []).length;
            const afterMatches = (fixedContent.match(/\/\*\s*REMOVED ANIMATION:.*?\/\*.*?\*\//g) || []).length;
            const fixed = beforeMatches - afterMatches;
            totalFixed += fixed;
            
            if (fixed > 0) {
                console.log(`🎯 Исправлено вложенных комментариев: ${fixed}`);
            }
        } else {
            console.log(`✅ Файл уже корректный: ${filePath}`);
        }
        
    } catch (error) {
        console.error(`❌ Ошибка обработки ${filePath}:`, error.message);
    }
});

console.log(`\n📊 РЕЗУЛЬТАТ ИСПРАВЛЕНИЯ:`);
console.log(`✅ Обработано файлов: ${fixedCount}`);
console.log(`🎯 Исправлено вложенных комментариев: ${totalFixed}`);
console.log(`\n💡 СЛЕДУЮЩИЕ ШАГИ:`);
console.log(`1. Запустите 'npm run build' для проверки билда`);
console.log(`2. При успехе можно удалить backup файлы`);
console.log(`3. При проблемах используйте backup для отката`);

console.log(`\n✅ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!`); 