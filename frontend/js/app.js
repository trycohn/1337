document.addEventListener('DOMContentLoaded', () => {
    // Перехватываем клики по навигации
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = link.getAttribute('data-screen');
            showScreen(screen);
        });
    });

    // Обрабатываем начальную загрузку и изменения истории
    window.addEventListener('popstate', (e) => {
        const state = e.state || { screen: 'home' };
        showScreen(state.screen, state);
    });

    // Загружаем начальный экран
    const initialPath = window.location.pathname.slice(1) || 'home';
    showScreen(initialPath);
});

// Функция переключения экранов (дублируем для совместимости)
function showScreen(screenId, params = {}) {
    document.querySelectorAll('main > section').forEach(section => {
        section.style.display = 'none';
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.style.display = 'block';

        // Если это экран admin и есть tournamentId, показываем детали
        if (screenId === 'admin' && params.tournamentId) {
            loadTournamentDetails(params.tournamentId);
        }
    } else {
        console.error(`Экран screen-${screenId} не найден`);
    }

    const url = `/${screenId}${params.tournamentId ? `?id=${params.tournamentId}` : ''}`;
    window.history.pushState({ screen: screenId, ...params }, '', url);
}

// Загрузка деталей турнира (пример)
function loadTournamentDetails(tournamentId) {
    // Здесь можно сделать fetch-запрос к /api/tournaments/:id
    // Пока просто показываем заглушку
    const detailsContainer = document.getElementById('tournamentDetails');
    const title = document.getElementById('tournamentTitle');
    if (detailsContainer && title) {
        detailsContainer.style.display = 'block';
        title.textContent = `Турнир ID: ${tournamentId}`;
    }
}