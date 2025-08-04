// ========================================
// ТЕСТИРОВАНИЕ ОПЦИИ FULL DOUBLE ELIMINATION
// ========================================

// 🧪 Скрипт для проверки функциональности в браузере
// Выполните в консоли разработчика (F12) на страницах:
// - http://1337community.com/create-tournament
// - http://1337community.com/tournament/[ID]/bracket

console.log('🧪 Запуск тестирования опции Full Double Elimination...');

// ТЕСТ 1: ПРОВЕРКА ФОРМЫ СОЗДАНИЯ ТУРНИРА
// ========================================
function testCreateTournamentForm() {
    console.log('\n🔍 ТЕСТ 1: Проверка формы создания турнира');
    
    // Находим селектор типа сетки
    const bracketTypeSelect = document.querySelector('select[name="bracket_type"]');
    if (!bracketTypeSelect) {
        console.error('❌ Селектор типа сетки не найден');
        return false;
    }
    
    // Устанавливаем Double Elimination
    bracketTypeSelect.value = 'double_elimination';
    bracketTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Ждем немного для обновления DOM
    setTimeout(() => {
        // Ищем чекбокс Full Double Elimination
        const fullDECheckbox = document.querySelector('input[name="full_double_elimination"]');
        if (fullDECheckbox) {
            console.log('✅ Чекбокс Full Double Elimination найден');
            console.log(`   Статус: ${fullDECheckbox.checked ? 'включен' : 'отключен'}`);
            
            // Проверяем подсказку
            const hint = fullDECheckbox.closest('.form-group')?.querySelector('.form-hint');
            if (hint && hint.textContent.includes('Grand Final Triumph')) {
                console.log('✅ Подсказка о Grand Final Triumph найдена');
            } else {
                console.warn('⚠️ Подсказка о Grand Final Triumph не найдена');
            }
            
            return true;
        } else {
            console.error('❌ Чекбокс Full Double Elimination не найден');
            console.log('   Возможные причины:');
            console.log('   - Frontend не развернут');
            console.log('   - Тип сетки не Double Elimination');
            console.log('   - Нет верификации пользователя');
            return false;
        }
    }, 500);
}

// ТЕСТ 2: ПРОВЕРКА ПАНЕЛИ УПРАВЛЕНИЯ СЕТКОЙ  
// ========================================
function testBracketManagementPanel() {
    console.log('\n🔍 ТЕСТ 2: Проверка панели управления сеткой');
    
    // Ищем кнопку настроек сетки
    const settingsButton = document.querySelector('button:has-text("Настроить и создать")') || 
                          document.querySelector('button[class*="generate"]') ||
                          Array.from(document.querySelectorAll('button')).find(btn => 
                              btn.textContent.includes('Настроить') || btn.textContent.includes('создать сетку')
                          );
    
    if (!settingsButton) {
        console.warn('⚠️ Кнопка настроек сетки не найдена');
        console.log('   Возможно страница не содержит панель управления сеткой');
        return false;
    }
    
    console.log('✅ Кнопка настроек сетки найдена');
    
    // Пытаемся найти чекбокс в развернутых настройках
    const fullDECheckbox = document.querySelector('input[type="checkbox"]') &&
                          Array.from(document.querySelectorAll('input[type="checkbox"]')).find(cb => 
                              cb.closest('label')?.textContent.includes('Full Double Elimination')
                          );
    
    if (fullDECheckbox) {
        console.log('✅ Чекбокс Full Double Elimination в настройках найден');
        return true;
    } else {
        console.log('ℹ️ Чекбокс пока не видим (может быть скрыт в настройках)');
        console.log('   Попробуйте нажать кнопку настроек сетки');
        return null; // неопределенный результат
    }
}

// ТЕСТ 3: ПРОВЕРКА API ENDPOINTS
// ========================================
async function testAPIEndpoints() {
    console.log('\n🔍 ТЕСТ 3: Проверка API endpoints');
    
    try {
        // Получаем токен авторизации
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('⚠️ Токен авторизации не найден');
            console.log('   Войдите в систему для полного тестирования API');
            return false;
        }
        
        // Тестовые данные для создания турнира
        const testTournamentData = {
            name: '🧪 Test Full Double Elimination',
            description: 'Тест опции Full Double Elimination',
            game: 'Counter-Strike 2',
            participant_type: 'team',
            team_size: 5,
            max_teams: 8,
            bracket_type: 'double_elimination',
            full_double_elimination: true // 🆕 НОВАЯ ОПЦИЯ
        };
        
        console.log('📤 Отправляем тестовый запрос создания турнира...');
        
        const response = await fetch('/api/tournaments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(testTournamentData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ API создания турнира работает');
            console.log(`   Создан турнир ID: ${result.tournament?.id}`);
            console.log(`   Full Double Elimination: ${result.tournament?.full_double_elimination}`);
            
            // Удаляем тестовый турнир
            if (result.tournament?.id) {
                try {
                    await fetch(`/api/tournaments/${result.tournament.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log('🗑️ Тестовый турнир удален');
                } catch (e) {
                    console.log('ℹ️ Не удалось удалить тестовый турнир (не критично)');
                }
            }
            
            return true;
        } else {
            const error = await response.json();
            console.error('❌ Ошибка API:', error);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Ошибка тестирования API:', error);
        return false;
    }
}

// ТЕСТ 4: ПРОВЕРКА БАЗЫ ДАННЫХ (через API)
// ========================================
async function testDatabaseSchema() {
    console.log('\n🔍 ТЕСТ 4: Проверка схемы базы данных');
    
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('⚠️ Нет токена для проверки базы данных');
            return false;
        }
        
        // Получаем любой существующий турнир для проверки схемы
        const response = await fetch('/api/tournaments?limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            const tournament = data.tournaments?.[0];
            
            if (tournament) {
                const hasFullDEField = 'full_double_elimination' in tournament;
                console.log(`${hasFullDEField ? '✅' : '❌'} Поле full_double_elimination ${hasFullDEField ? 'найдено' : 'отсутствует'}`);
                console.log(`   Пример турнира: ${tournament.name}`);
                console.log(`   Тип сетки: ${tournament.bracket_type}`);
                console.log(`   Full DE: ${tournament.full_double_elimination}`);
                return hasFullDEField;
            } else {
                console.log('ℹ️ Нет турниров для проверки схемы');
                return null;
            }
        } else {
            console.error('❌ Ошибка получения турниров');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Ошибка проверки базы данных:', error);
        return false;
    }
}

// ОСНОВНАЯ ФУНКЦИЯ ТЕСТИРОВАНИЯ
// ========================================
async function runAllTests() {
    console.log('🚀 Запуск полного тестирования...\n');
    
    const results = {
        createForm: false,
        bracketPanel: false,
        api: false,
        database: false
    };
    
    // Определяем текущую страницу
    const currentPath = window.location.pathname;
    console.log(`📍 Текущая страница: ${currentPath}`);
    
    // Запускаем тесты в зависимости от страницы
    if (currentPath.includes('create-tournament')) {
        console.log('🎯 Запуск тестов для страницы создания турнира');
        results.createForm = testCreateTournamentForm();
    } else if (currentPath.includes('tournament') && currentPath.includes('bracket')) {
        console.log('🎯 Запуск тестов для страницы управления сеткой');
        results.bracketPanel = testBracketManagementPanel();
    } else {
        console.log('ℹ️ Универсальные тесты (API и база данных)');
    }
    
    // API тесты (везде)
    results.api = await testAPIEndpoints();
    results.database = await testDatabaseSchema();
    
    // Итоговый отчет
    console.log('\n📊 ИТОГОВЫЙ ОТЧЕТ:');
    console.log('====================');
    Object.entries(results).forEach(([test, result]) => {
        const status = result === true ? '✅ ПРОЙДЕН' : 
                      result === false ? '❌ ПРОВАЛЕН' : 
                      result === null ? '⚠️ ЧАСТИЧНО' : '⏭️ ПРОПУЩЕН';
        console.log(`${test.padEnd(15)}: ${status}`);
    });
    
    const passedTests = Object.values(results).filter(r => r === true).length;
    const totalTests = Object.values(results).filter(r => r !== undefined).length;
    
    console.log(`\n🎯 Результат: ${passedTests}/${totalTests} тестов пройдено`);
    
    if (passedTests === totalTests) {
        console.log('🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ! Опция Full Double Elimination работает корректно!');
    } else {
        console.log('⚠️ Некоторые тесты не прошли. Проверьте развертывание.');
    }
    
    return results;
}

// Автоматический запуск через 1 секунду
setTimeout(() => {
    runAllTests().catch(console.error);
}, 1000);

// Экспорт функций для ручного использования
window.testFullDoubleElimination = {
    runAll: runAllTests,
    testCreateForm: testCreateTournamentForm,
    testBracketPanel: testBracketManagementPanel,
    testAPI: testAPIEndpoints,
    testDatabase: testDatabaseSchema
};

console.log('ℹ️ Доступны функции: window.testFullDoubleElimination.*');
console.log('📖 Пример: testFullDoubleElimination.runAll()');