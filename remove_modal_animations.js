#!/usr/bin/env node

/**
 * 🚀 Скрипт удаления анимаций из модальных окон
 * 
 * Проблема: Анимации модальных окон вызывают лаги в приложении
 * Решение: Убираем все transition, animation, transform свойства
 * 
 * Этот скрипт:
 * 1. Находит все CSS файлы модальных окон
 * 2. Удаляет/комментирует анимации
 * 3. Создает backup файлы
 * 4. Показывает отчет об изменениях
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 УДАЛЕНИЕ АНИМАЦИЙ ИЗ МОДАЛЬНЫХ ОКОН');
console.log('='.repeat(50));

// Список файлов модальных окон для обработки
const modalCssFiles = [
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

// Регулярные выражения для поиска анимационных свойств
const animationPatterns = [
    /transition\s*:\s*[^;]+;/gi,
    /animation\s*:\s*[^;]+;/gi,
    /transform\s*:\s*[^;]+;/gi,
    /-webkit-transition\s*:\s*[^;]+;/gi,
    /-webkit-animation\s*:\s*[^;]+;/gi,
    /-webkit-transform\s*:\s*[^;]+;/gi,
    /-moz-transition\s*:\s*[^;]+;/gi,
    /-moz-animation\s*:\s*[^;]+;/gi,
    /-moz-transform\s*:\s*[^;]+;/gi,
    /-o-transition\s*:\s*[^;]+;/gi,
    /-o-animation\s*:\s*[^;]+;/gi,
    /-o-transform\s*:\s*[^;]+;/gi,
    /-ms-transition\s*:\s*[^;]+;/gi,
    /-ms-animation\s*:\s*[^;]+;/gi,
    /-ms-transform\s*:\s*[^;]+;/gi,
    /animation-[a-z-]+\s*:\s*[^;]+;/gi,
    /transition-[a-z-]+\s*:\s*[^;]+;/gi,
    /@keyframes\s+[^{]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi
];

// Функция создания backup файла
function createBackup(filePath) {
    const backupPath = `${filePath}.no-animations-backup.${Date.now()}`;
    fs.copyFileSync(filePath, backupPath);
    console.log(`📦 Backup создан: ${backupPath}`);
    return backupPath;
}

// Функция удаления анимаций из CSS контента
function removeAnimations(cssContent, filePath) {
    let modifiedContent = cssContent;
    let removedCount = 0;
    let removedItems = [];

    animationPatterns.forEach(pattern => {
        const matches = cssContent.match(pattern);
        if (matches) {
            matches.forEach(match => {
                const commentedMatch = `/* REMOVED ANIMATION: ${match.trim()} */`;
                modifiedContent = modifiedContent.replace(match, commentedMatch);
                removedItems.push(match.trim());
                removedCount++;
            });
        }
    });

    return {
        content: modifiedContent,
        removedCount,
        removedItems
    };
}

// Основная функция обработки файлов
async function processModalFiles() {
    let totalFilesProcessed = 0;
    let totalAnimationsRemoved = 0;
    const processResults = [];

    for (const filePath of modalCssFiles) {
        console.log(`\n🔧 Обрабатываем: ${filePath}`);
        
        // Проверяем существование файла
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ Файл не найден: ${filePath}`);
            continue;
        }

        try {
            // Читаем файл
            const originalContent = fs.readFileSync(filePath, 'utf8');
            
            // Создаем backup
            const backupPath = createBackup(filePath);
            
            // Удаляем анимации
            const result = removeAnimations(originalContent, filePath);
            
            // Записываем измененный файл
            fs.writeFileSync(filePath, result.content, 'utf8');
            
            const fileResult = {
                filePath,
                backupPath,
                removedCount: result.removedCount,
                removedItems: result.removedItems
            };
            
            processResults.push(fileResult);
            totalFilesProcessed++;
            totalAnimationsRemoved += result.removedCount;
            
            console.log(`✅ Обработан: ${result.removedCount} анимаций удалено`);
            
            if (result.removedItems.length > 0) {
                console.log(`📋 Удаленные анимации:`);
                result.removedItems.forEach(item => {
                    console.log(`   • ${item}`);
                });
            }
            
        } catch (error) {
            console.error(`❌ Ошибка обработки ${filePath}:`, error.message);
        }
    }

    return {
        totalFilesProcessed,
        totalAnimationsRemoved,
        processResults
    };
}

// Функция генерации отчета
function generateReport(results) {
    console.log(`\n📊 ОТЧЕТ ОБ УДАЛЕНИИ АНИМАЦИЙ`);
    console.log('='.repeat(40));
    console.log(`✅ Обработано файлов: ${results.totalFilesProcessed}`);
    console.log(`🎬 Удалено анимаций: ${results.totalAnimationsRemoved}`);
    
    if (results.processResults.length > 0) {
        console.log(`\n📋 Детальный отчет по файлам:`);
        results.processResults.forEach(result => {
            console.log(`   ${path.basename(result.filePath)}: ${result.removedCount} анимаций`);
        });
        
        console.log(`\n🔄 Для отката изменений используйте backup файлы:`);
        results.processResults.forEach(result => {
            if (result.removedCount > 0) {
                console.log(`   cp "${result.backupPath}" "${result.filePath}"`);
            }
        });
    }
    
    console.log(`\n💡 РЕКОМЕНДАЦИИ:`);
    console.log(`   1. Перезапустите frontend для применения изменений`);
    console.log(`   2. Проверьте работу модальных окон`);
    console.log(`   3. Backup файлы можно удалить после тестирования`);
    console.log(`   4. При необходимости можно откатить изменения`);
}

// Функция создания CSS оптимизации для модальных окон
function createOptimizedModalCSS() {
    const optimizedCSS = `
/* 🚀 ОПТИМИЗИРОВАННЫЕ СТИЛИ МОДАЛЬНЫХ ОКОН БЕЗ АНИМАЦИЙ */

/* Базовые стили для всех модальных окон */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    /* УДАЛЕНЫ ВСЕ АНИМАЦИИ ДЛЯ ПОВЫШЕНИЯ ПРОИЗВОДИТЕЛЬНОСТИ */
}

.modal-content {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 20px;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    /* УДАЛЕНЫ ВСЕ АНИМАЦИИ ДЛЯ ПОВЫШЕНИЯ ПРОИЗВОДИТЕЛЬНОСТИ */
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid #333;
    padding-bottom: 10px;
}

.modal-close {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    /* УДАЛЕНЫ ВСЕ АНИМАЦИИ ДЛЯ ПОВЫШЕНИЯ ПРОИЗВОДИТЕЛЬНОСТИ */
}

.modal-close:hover {
    color: #ff4444;
    /* НЕТ TRANSITION - МГНОВЕННОЕ ИЗМЕНЕНИЕ */
}

/* Стили для кнопок в модальных окнах */
.modal-button {
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    /* УДАЛЕНЫ ВСЕ АНИМАЦИИ ДЛЯ ПОВЫШЕНИЯ ПРОИЗВОДИТЕЛЬНОСТИ */
}

.modal-button:hover {
    opacity: 0.8;
    /* НЕТ TRANSITION - МГНОВЕННОЕ ИЗМЕНЕНИЕ */
}

.modal-button-primary {
    background: #4CAF50;
    color: white;
}

.modal-button-secondary {
    background: #f44336;
    color: white;
}

.modal-button-neutral {
    background: #666;
    color: white;
}
`;

    fs.writeFileSync('frontend/src/components/modal-optimized.css', optimizedCSS, 'utf8');
    console.log(`✅ Создан оптимизированный файл стилей: frontend/src/components/modal-optimized.css`);
}

// Запуск обработки
(async () => {
    try {
        console.log(`🔍 Будет обработано ${modalCssFiles.length} файлов CSS модальных окон\n`);
        
        const results = await processModalFiles();
        generateReport(results);
        
        // Создаем оптимизированный CSS файл
        createOptimizedModalCSS();
        
        console.log(`\n✅ ОБРАБОТКА ЗАВЕРШЕНА`);
        console.log(`🚀 Анимации удалены, производительность должна улучшиться!`);
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    }
})(); 