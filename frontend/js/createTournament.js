document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('createTournamentForm');
    if (!createForm) {
        console.error('Форма createTournamentForm не найдена');
        return;
    }

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Считываем поля формы
        const name = document.getElementById('tournamentName').value.trim();
        const description = document.getElementById('tournamentDescription').value.trim();
        const game = document.getElementById('tournamentGame').value;
        const type = document.getElementById('tournamentType').value;

        // Валидация на фронтенде
        if (!name || !game) {
            alert('Пожалуйста, заполните название и игру');
            return;
        }

        try {
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                throw new Error('Нет токена авторизации. Пожалуйста, войдите в систему.');
            }

            // Отправляем запрос на создание турнира
            const response = await fetch('http://localhost:3000/api/tournaments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    description,
                    game,
                    type
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ошибка при создании турнира: ${errorText}`);
            }

            const data = await response.json();
            console.log('Турнир успешно создан:', data);

            // Показываем сообщение об успехе
            alert('Турнир успешно создан!');

            // Переключаем экран на admin и обновляем детали
            showScreen('admin', { tournamentId: data.id });
            setTimeout(() => updateTournamentDetails(data), 0); // Даём DOM время обновиться

            // Очищаем форму
            createForm.reset();
        } catch (error) {
            console.error('Ошибка:', error);
            alert(error.message);
        }
    });
});

// Функция для переключения экранов
function showScreen(screenId, params = {}) {
    // Скрываем все экраны
    document.querySelectorAll('main > section').forEach(section => {
        section.style.display = 'none';
    });

    // Показываем нужный экран
    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.style.display = 'block';
    } else {
        console.error(`Экран screen-${screenId} не найден`);
        return;
    }

    // Обновляем URL с помощью pushState
    const url = `/${screenId}${params.tournamentId ? `?id=${params.tournamentId}` : ''}`;
    window.history.pushState({ screen: screenId, ...params }, '', url);
}

// Функция для отображения деталей турнира
function updateTournamentDetails(tournament) {
    const detailsContainer = document.getElementById('tournamentDetails');
    const title = document.getElementById('tournamentTitle');

    if (!detailsContainer || !title) {
        console.error('Контейнер tournamentDetails или tournamentTitle не найден');
        return;
    }

    // Показываем блок деталей
    detailsContainer.style.display = 'block';
    title.textContent = `${tournament.name} [${tournament.game}] - ${tournament.status}`;

    // Опционально: можно добавить больше деталей
    const participantList = document.getElementById('participantListContainer');
    if (participantList) {
        participantList.innerHTML = '<li>Участники ещё не добавлены</li>';
    }
}