document.addEventListener('DOMContentLoaded', () => {
    // Делегированный обработчик кликов для всех ссылок с data-screen
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a[data-screen]');
        if (target) {
            e.preventDefault();
            const screen = target.getAttribute('data-screen');
            const url = new URL(target.href); // Remove window.location.origin to keep the path as in the link
            let tournamentId = url.searchParams.get('tournamentId') || url.searchParams.get('id');
            console.log('Clicked link with data-screen. screen:', screen, 'tournamentId:', tournamentId);
            showScreen(screen, tournamentId ? { tournamentId } : {});
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
    showScreen(initialPath, tournamentId ? { tournamentId } : {});
});

function showScreen(screenId, params = {}) {
    console.log('Transition to screen:', screenId, params);
    document.querySelectorAll('main > section').forEach(section => {
        section.style.display = 'none';
    });

    const targetScreen = document.getElementById(`screen-${screenId}`);
    if (targetScreen) {
        targetScreen.style.display = 'block';

        if (screenId === 'admin' && params.tournamentId) {
            updateAdminData(params.tournamentId);
        } else {
            window.currentTournamentId = null; // Clear current tournament on other screens
            clearAdminData();
        }
    } else {
        console.error(`Screen screen-${screenId} not found`);
    }

    // Update URL using pushState
    const tidForUrl = params.tournamentId || window.currentTournamentId;
    const newUrl = `/${screenId}${tidForUrl ? `?id=${tidForUrl}` : ''}`;
    console.log('Updating URL:', newUrl);
    window.history.pushState({ screen: screenId, ...params }, '', newUrl);
}

function updateAdminData(tournamentId) {
    console.log('Updating data for tournament ID:', tournamentId);
    window.currentTournamentId = tournamentId;
    console.log('Set currentTournamentId:', window.currentTournamentId);

    const tournamentList = document.getElementById('myTournamentsContainer');
    if (tournamentList) tournamentList.style.display = 'none';
    const details = document.getElementById('tournamentDetails');
    if (details) details.style.display = 'block';

    // Call functions to load tournament data
    if (typeof loadTournamentDetails === 'function') {
        loadTournamentDetails(tournamentId);
    }
    resetParticipantContainer();
    setTimeout(() => {
        if (typeof loadParticipants === 'function') {
            console.log('Forcing load of participant list for tournament ID:', tournamentId);
            loadParticipants(tournamentId);
        }
        if (typeof loadParticipantsOrTeams === 'function') {
            loadParticipantsOrTeams(tournamentId);
        }
        if (typeof loadMatches === 'function') {
            loadMatches(tournamentId);
        }
    }, 200);

    setBackToTournamentsLinkVisibility(true); // Show "back to tournaments" link
}

function clearAdminData() {
    window.currentTournamentId = null;
    const tournamentList = document.getElementById('myTournamentsContainer');
    if (tournamentList) tournamentList.style.display = 'block';
    const details = document.getElementById('tournamentDetails');
    if (details) details.style.display = 'none';

    setBackToTournamentsLinkVisibility(false); // Hide "back to tournaments" link
}

function setBackToTournamentsLinkVisibility(visible) {
    const backToTournamentsLink = document.getElementById('backToTournamentsLink');
    if (backToTournamentsLink) {
        backToTournamentsLink.style.display = visible ? 'block' : 'none';
    }
}

function resetParticipantContainer() {
    let oldContainer = document.getElementById('participantListContainer');
    if (oldContainer) {
        oldContainer.innerHTML = '';
    }
    return ensureParticipantContainer();
}

function ensureParticipantContainer() {
    let container = document.getElementById('participantListContainer');
    if (!container) {
        container = document.createElement('ul');
        container.id = 'participantListContainer';
        const details = document.getElementById('tournamentDetails');
        if (details) {
            details.appendChild(container);
        } else {
            document.getElementById('screen-admin').appendChild(container);
        }
    }
    return container;
}
