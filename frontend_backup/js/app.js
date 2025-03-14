// Импортируем необходимые функции из других файлов
import { loadAndDisplayTournamentDetails, loadAndDisplayParticipants } from './tournamentDetails.js';
import { getUserData } from './auth.js'; // Импортируем getUserData для проверки авторизации

// Основной обработчик загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем авторизацию пользователя при загрузке приложения
    const userData = await getUserData();
    if (userData) {
        console.log('Пользователь авторизован:', userData);
    } else {
        console.log('Пользователь не авторизован');
    }

    // Делегированный обработчик кликов для всех ссылок с data-screen
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('a[data-screen]');
        if (target) {
            e.preventDefault();
            const screen = target.getAttribute('data-screen');
            const url = new URL(target.href);
            const tournamentId = url.searchParams.get('tournamentId') || url.searchParams.get('id');
            console.log('Clicked link with data-screen. screen:', screen, 'tournamentId:', tournamentId);
            await showScreen(screen, tournamentId ? { tournamentId } : {});
        }
    });

    // Обработка изменения истории браузера (popstate)
    window.addEventListener('popstate', (e) => {
        const state = e.state || { screen: 'home' };
        console.log('popstate event:', state);
        showScreen(state.screen, state);
    });

    // Загружаем начальный экран (по URL или по умолчанию "home")
    const initialPath = window.location.pathname.slice(1) || 'home';
    console.log('Initial screen:', initialPath);
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get('id') || urlParams.get('tournamentId');
    await showScreen(initialPath, tournamentId ? { tournamentId } : {});
});

// Асинхронная функция для отображения экрана
async function showScreen(screenId, params = {}) {
    console.log('Transition to screen:', screenId, params);
    document.querySelectorAll('main > section').forEach(section => {
        section.style.display = 'none';
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.style.display = 'block';
        try {
            if (screenId === 'admin' && params.tournamentId) {
                await updateAdminData(params.tournamentId); // Загружаем данные турнира
                await updateUI(params.tournamentId);       // Проверяем роль и обновляем интерфейс
            } else {
                window.currentTournamentId = null;
                clearAdminData(); // Очищаем данные, если не на экране администратора
            }
        } catch (error) {
            console.error('Ошибка при загрузке экрана:', error);
        }
    } else {
        console.error(`Screen screen-${screenId} not found`);
    }

    // Обновляем URL с помощью pushState
    const tidForUrl = params.tournamentId || window.currentTournamentId;
    const newUrl = `/${screenId}${tidForUrl ? `?id=${tidForUrl}` : ''}`;
    console.log('Updating URL:', newUrl);
    window.history.pushState({ screen: screenId, ...params }, '', newUrl);
}

// Функция для загрузки данных турнира и пользователя
async function loadData(tournamentId) {
    try {
        const tournamentResponse = await fetch(`/api/tournaments/${tournamentId}`);
        if (!tournamentResponse.ok) throw new Error('Не удалось загрузить турнир');
        const tournament = await tournamentResponse.json();

        const userResponse = await fetch('/api/users/me', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
        });
        if (!userResponse.ok) throw new Error('Не удалось загрузить пользователя');
        const user = await userResponse.json();

        return { tournament, user };
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        return { tournament: null, user: null };
    }
}

// Функция для проверки роли пользователя в турнире
async function checkUserRole(tournamentId) {
    const { tournament, user } = await loadData(tournamentId);
    if (!tournament || !user) {
        return { isCreator: false, isAdmin: false };
    }
    const isCreator = user.id === tournament.created_by;
    const isAdmin = tournament.admins && Array.isArray(tournament.admins) ? tournament.admins.includes(user.id) : false;
    return { isCreator, isAdmin };
}

// Функция для обновления интерфейса на основе роли пользователя
async function updateUI(tournamentId) {
    const { isCreator, isAdmin } = await checkUserRole(tournamentId);
    const adminControls = document.getElementById('adminControls'); // Элемент управления для администраторов
    if (adminControls) {
        if (isCreator || isAdmin) {
            adminControls.style.display = 'block'; // Показываем элементы управления, если пользователь имеет права
        } else {
            adminControls.style.display = 'none';  // Скрываем, если прав нет
        }
    }
}

// Функция для обновления данных администратора
async function updateAdminData(tournamentId) {
    console.log('Updating data for tournament ID:', tournamentId);
    window.currentTournamentId = tournamentId; // Сохраняем текущий ID турнира
    console.log('Set currentTournamentId:', window.currentTournamentId);

    const tournamentList = document.getElementById('myTournamentsContainer');
    if (tournamentList) tournamentList.style.display = 'none'; // Скрываем список турниров
    const details = document.getElementById('tournamentDetails');
    if (details) details.style.display = 'block';              // Показываем детали турнира

    // Загружаем данные турнира и участников
    try {
        await loadAndDisplayTournamentDetails(tournamentId); // Загружаем детали турнира
        await loadAndDisplayParticipants(tournamentId);      // Загружаем участников
        // Дополнительные функции можно добавить здесь, например:
        // await loadMatches(tournamentId);
    } catch (error) {
        console.error('Ошибка при загрузке данных турнира:', error);
    }

    setBackToTournamentsLinkVisibility(true); // Показываем ссылку "Назад к турнирам"
}

// Функция для очистки данных администратора
function clearAdminData() {
    window.currentTournamentId = null; // Сбрасываем текущий ID турнира
    const tournamentList = document.getElementById('myTournamentsContainer');
    if (tournamentList) tournamentList.style.display = 'block'; // Показываем список турниров
    const details = document.getElementById('tournamentDetails');
    if (details) details.style.display = 'none';                // Скрываем детали турнира

    setBackToTournamentsLinkVisibility(false); // Скрываем ссылку "Назад к турнирам"
}

// Функция для управления видимостью ссылки "Назад к турнирам"
function setBackToTournamentsLinkVisibility(visible) {
    const backToTournamentsLink = document.getElementById('backToTournamentsLink');
    if (backToTournamentsLink) {
        backToTournamentsLink.style.display = visible ? 'block' : 'none';
    }
}

// Функция для сброса контейнера участников
function resetParticipantContainer() {
    let oldContainer = document.getElementById('participantListContainer');
    if (oldContainer) {
        oldContainer.innerHTML = ''; // Очищаем содержимое контейнера
    }
    return ensureParticipantContainer(); // Возвращаем контейнер (существующий или новый)
}

// Функция для создания контейнера участников, если его нет
function ensureParticipantContainer() {
    let container = document.getElementById('participantListContainer');
    if (!container) {
        container = document.createElement('ul');           // Создаем новый контейнер
        container.id = 'participantListContainer';
        const details = document.getElementById('tournamentDetails');
        if (details) {
            details.appendChild(container);                // Добавляем в блок деталей
        } else {
            document.getElementById('screen-admin').appendChild(container); // Или в экран администратора
        }
    }
    return container;
}