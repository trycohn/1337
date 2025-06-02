console.log('Проверка V4 ULTIMATE...');

const fs = require('fs');

const files = [
    'frontend/src/components/V4StatsDashboard.js',
    'frontend/src/components/V4ProfileHooks.js',
    'frontend/src/components/V4Stats.css'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        console.log('✅', file);
    } else {
        console.log('❌', file);
    }
});

console.log('\nДля запуска фронтенда:');
console.log('1. cd frontend');
console.log('2. npm start'); 