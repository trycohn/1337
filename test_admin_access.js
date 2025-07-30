// 🧪 ТЕСТ ДОСТУПА АДМИНИСТРАТОРОВ К ВКЛАДКЕ УПРАВЛЕНИЯ
// Запустите в консоли браузера на странице турнира

console.log('🧪️ === ТЕСТИРОВАНИЕ ДОСТУПА К ВКЛАДКЕ УПРАВЛЕНИЯ ===');

// 1. Проверяем данные турнира
const currentUrl = window.location.href;
const tournamentId = currentUrl.match(/tournaments\/(\d+)/)?.[1];

if (!tournamentId) {
    console.log('❌ Не найден ID турнира в URL');
} else {
    console.log(`🎯 ID турнира: ${tournamentId}`);
}

// 2. Проверяем наличие вкладки управления в DOM
const managementTab = document.querySelector('[class*="tab-button"][class*="management"]');
const managementTabByText = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.includes('Управление') || btn.textContent.includes('⚙️')
);

console.log('🔍 Проверка вкладки управления:');
console.log('  - Найдена по селектору:', managementTab ? '✅ ДА' : '❌ НЕТ');
console.log('  - Найдена по тексту:', managementTabByText ? '✅ ДА' : '❌ НЕТ');

if (managementTabByText) {
    const isVisible = managementTabByText.offsetParent !== null;
    const isDisabled = managementTabByText.disabled;
    console.log('  - Видимость:', isVisible ? '✅ ВИДИМА' : '❌ СКРЫТА');
    console.log('  - Доступность:', isDisabled ? '❌ ОТКЛЮЧЕНА' : '✅ АКТИВНА');
}

// 3. Получаем данные турнира от API
async function checkTournamentData() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('❌ Токен авторизации не найден');
            return;
        }

        const response = await fetch(`/api/tournaments/${tournamentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.log(`❌ Ошибка API: ${response.status}`);
            return;
        }

        const tournament = response.json ? await response.json() : response;
        
        console.log('📊 Данные турнира:');
        console.log('  - Название:', tournament.name);
        console.log('  - Создатель ID:', tournament.created_by);
        console.log('  - Администраторы:', Array.isArray(tournament.admins) ? tournament.admins.length : 'не массив');
        
        if (Array.isArray(tournament.admins) && tournament.admins.length > 0) {
            console.log('👥 Список администраторов:');
            tournament.admins.forEach((admin, index) => {
                console.log(`  ${index + 1}. ID: ${admin.user_id}, Имя: ${admin.username}`);
            });
        }

        // 4. Проверяем текущего пользователя
        const userResponse = await fetch('/api/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (userResponse.ok) {
            const user = await userResponse.json();
            console.log('👤 Текущий пользователь:');
            console.log('  - ID:', user.id);
            console.log('  - Имя:', user.username);
            
            const isCreator = user.id === tournament.created_by;
            const isAdmin = Array.isArray(tournament.admins) ? 
                tournament.admins.some(admin => admin.user_id === user.id) : false;
            
            console.log('🔑 Права доступа:');
            console.log('  - Создатель турнира:', isCreator ? '✅ ДА' : '❌ НЕТ');
            console.log('  - Администратор турнира:', isAdmin ? '✅ ДА' : '❌ НЕТ');
            console.log('  - Доступ к управлению:', (isCreator || isAdmin) ? '✅ ДА' : '❌ НЕТ');
            
            if (!isCreator && !isAdmin) {
                console.log('💡 Чтобы получить доступ к управлению турниром:');
                console.log('   1. Попросите создателя пригласить вас в администраторы');
                console.log('   2. Примите приглашение в системном чате');
                console.log('   3. Обновите страницу');
            }
        }

    } catch (error) {
        console.error('❌ Ошибка проверки:', error);
    }
}

// Запускаем проверку
checkTournamentData();

console.log('🎯 ИНСТРУКЦИЯ:');
console.log('1. Убедитесь что вы авторизованы');
console.log('2. Проверьте результаты выше');
console.log('3. Если нет доступа - попросите приглашение от создателя');
console.log('4. Примите приглашение и обновите страницу'); 