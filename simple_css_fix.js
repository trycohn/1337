#!/usr/bin/env node

const fs = require('fs');

// Читаем и исправляем MatchDetailsModal.css
const file = 'frontend/src/components/tournament/modals/MatchDetailsModal.css';
console.log('Исправляем MatchDetailsModal.css...');

let content = fs.readFileSync(file, 'utf8');

// Backup
fs.writeFileSync(file + '.backup.' + Date.now(), content);

// Исправляем основные проблемы
content = content.replace(
    /\/\* REMOVED ANIMATION: \*\/ REMOVED ANIMATION: \/\* REMOVED ANIMATION: \*\/ REMOVED ANIMATION: \/\* REMOVED ANIMATION: transition: all 0\.3s ease; \*\//g,
    '/* REMOVED ANIMATION: transition: all 0.3s ease; */'
);

content = content.replace(
    /\/\* REMOVED ANIMATION: transform: scale\(1\.1\); \*\//g,
    '/* REMOVED ANIMATION: transform: scale(1.1); */'
);

content = content.replace(
    /\/\* REMOVED ANIMATION: @keyframes crownGlow \{\s*from \{ box-shadow: 0 2px 8px rgba\(255, 215, 0, 0\.3\); \*\/ \}\s*to \{ box-shadow: 0 4px 16px rgba\(255, 215, 0, 0\.6\); \}\s*\} \*\//g,
    '/* REMOVED ANIMATION: @keyframes crownGlow { from { box-shadow: 0 2px 8px rgba(255, 215, 0, 0.3); } to { box-shadow: 0 4px 16px rgba(255, 215, 0, 0.6); } } */'
);

content = content.replace(
    /\/\* REMOVED ANIMATION: @keyframes pulse \{\s*0%, 100% \{ opacity: 1; \*\/ \}\s*50% \{ opacity: 0\.5; \}\s*\} \*\//g,
    '/* REMOVED ANIMATION: @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } } */'
);

// Сохраняем исправленный файл
fs.writeFileSync(file, content);
console.log('✅ MatchDetailsModal.css исправлен!'); 