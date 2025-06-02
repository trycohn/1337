console.log('🔍 Диагностика вкладок профиля...');

// Проверка в браузере - выполните этот код в консоли разработчика (F12)
console.log('1. Проверка навигации:');
const navTabs = document.querySelectorAll('.nav-tab-profile');
console.log('Найдено вкладок:', navTabs.length);
navTabs.forEach((tab, index) => {
    const text = tab.querySelector('span:last-child')?.textContent;
    console.log(`  ${index + 1}. ${text}`);
});

console.log('\n2. Проверка активной вкладки:');
const activeTab = document.querySelector('.nav-tab-profile.active');
if (activeTab) {
    const activeText = activeTab.querySelector('span:last-child')?.textContent;
    console.log('Активная вкладка:', activeText);
} else {
    console.log('❌ Активная вкладка не найдена');
}

console.log('\n3. Проверка контента:');
const contentSections = {
    main: document.querySelector('[activeTab="main"]'),
    stats: document.querySelector('[activeTab="stats"]'),
    friends: document.querySelector('[activeTab="friends"]'),
    organization: document.querySelector('[activeTab="organization"]'),
    tournaments: document.querySelector('[activeTab="tournaments"]'),
    v4analytics: document.querySelector('[activeTab="v4analytics"]')
};

Object.entries(contentSections).forEach(([tab, element]) => {
    console.log(`${tab}:`, element ? '✅ найден' : '❌ не найден');
});

console.log('\n4. Проверка ошибок JavaScript:');
console.log('Откройте вкладку Console и проверьте наличие ошибок (красные сообщения)');

console.log('\n5. Проверка React состояния:');
console.log('Если используете React DevTools, проверьте состояние activeTab в компоненте Profile');

console.log('\n📋 Инструкции:');
console.log('1. Откройте сайт в браузере');
console.log('2. Откройте Developer Tools (F12)');
console.log('3. Перейдите на вкладку Console');
console.log('4. Вставьте и выполните этот код');
console.log('5. Проверьте результаты'); 