document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('createTournamentForm');
    if (!createForm) {
        console.error('Форма createTournamentForm не найдена');
        return;
    }

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('tournamentName').value.trim();
        const description = document.getElementById('tournamentDescription').value.trim();
        const game = document.getElementById('tournamentGame').value;
        const type = document.getElementById('tournamentType').value;

        if (!name || !game) {
            alert('Пожалуйста, заполните название и игру');
            return;
        }

        try {
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                throw new Error('Нет токена авторизации. Пожалуйста, войдите в систему.');
            }

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

            // Переключаем экран и обновляем детали после полной отрисовки
            showScreen('admin', { tournamentId: data.id });
            requestAnimationFrame(() => {
                requestAnimationFrame(() => updateTournamentDetails(data)); // Двойной вызов для гарантии
            });

            createForm.reset();
        } catch (error) {
            console.error('Ошибка:', error);
            alert(error.message);
        }
    });
});

function showScreen(screenId, params = {}) {
    document.querySelectorAll('main > section').forEach(section => {
        section.style.display = 'none';
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.style.display = 'block';
    } else {
        console.error(`Экран screen-${screenId} не найден`);
        return;
    }

    const url = `/${screenId}${params.tournamentId ? `?id=${params.tournamentId}` : ''}`;
    window.history.pushState({ screen: screenId, ...params }, '', url);
}

function updateTournamentDetails(tournament) {
    console.log('Обновление деталей, DOM:', document.getElementById('tournamentDetails'));

    const detailsContainer = document.getElementById('tournamentDetails');
    const title = document.getElementById('tournamentTitle');
    const successMessage = document.getElementById('creationSuccess');

    if (!detailsContainer || !title || !successMessage) {
        console.error('Контейнер tournamentDetails, tournamentTitle или creationSuccess не найден');
        console.log('detailsContainer:', detailsContainer);
        console.log('title:', title);
        console.log('successMessage:', successMessage);
        console.log('Полный DOM секции:', document.getElementById('screen-admin').innerHTML);
        return;
    }

    detailsContainer.style.display = 'block';
    successMessage.style.display = 'block';
    title.textContent = `${tournament.name} [${tournament.game}] - ${tournament.status}`;

    const hideButton = document.getElementById('hideSuccessMessage');
    if (hideButton) {
        hideButton.onclick = () => {
            successMessage.style.display = 'none';
        };
    }

    const participantList = document.getElementById('participantListContainer');
    if (participantList) {
        participantList.innerHTML = '<li>Участники ещё не добавлены</li>';
    }
}