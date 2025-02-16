document.addEventListener('DOMContentLoaded', () => {
    const tournamentId = getTournamentIdFromUrl();
    if (tournamentId) {
        loadTournamentInfo();
        loadTeams();
        loadMatches();
    }
});

// ✅ Получение ID турнира из URL
function getTournamentIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// ✅ Загрузка информации о турнире
async function loadTournamentInfo() {
    const tournamentId = getTournamentIdFromUrl();
    if (!tournamentId) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}`);
        if (!response.ok) throw new Error(`Ошибка загрузки информации о турнире`);

        const data = await response.json();
        displayTournamentInfo(data.tournament);
    } catch (error) {
        console.error('Ошибка загрузки турнира:', error);
        document.getElementById('tournamentInfo').innerText = 'Ошибка загрузки информации о турнире.';
    }
}

// ✅ Отображение информации о турнире
function displayTournamentInfo(tournament) {
    const container = document.getElementById('tournamentInfo');
    container.innerHTML = `
        <h2>${tournament.name}</h2>
        <p><strong>Описание:</strong> ${tournament.description || 'Нет описания'}</p>
        <p><strong>Игра:</strong> ${tournament.game}</p>
        <p><strong>Статус:</strong> ${tournament.status}</p>
        <p><strong>Создан:</strong> ${new Date(tournament.created_at).toLocaleString()}</p>
    `;
}

// ✅ Загрузка списка команд
async function loadTeams() {
    const tournamentId = getTournamentIdFromUrl();
    if (!tournamentId) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/teams`);
        if (!response.ok) throw new Error('Ошибка загрузки списка команд');

        const data = await response.json();
        displayTeams(data.teams);
    } catch (error) {
        console.error('Ошибка загрузки команд:', error);
        document.getElementById('teamsContainer').innerText = 'Ошибка загрузки команд.';
    }
}

// ✅ Отображение списка команд
function displayTeams(teams) {
    const container = document.getElementById('teamsContainer');
    container.innerHTML = '';

    if (teams.length === 0) {
        container.innerText = 'Команды не найдены.';
        return;
    }

    const list = document.createElement('ul');
    teams.forEach(team => {
        const listItem = document.createElement('li');
        listItem.textContent = `${team.name} (${team.players_count} игроков)`;
        list.appendChild(listItem);
    });

    container.appendChild(list);
}

// ✅ Загрузка матчей турнира
async function loadMatches() {
    const tournamentId = getTournamentIdFromUrl();
    if (!tournamentId) return;

    try {
        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/matches`);
        if (!response.ok) throw new Error('Ошибка загрузки матчей');

        const data = await response.json();
        displayMatches(data.matches);
    } catch (error) {
        console.error('Ошибка загрузки матчей:', error);
        document.getElementById('matchesContainer').innerText = 'Ошибка загрузки матчей.';
    }
}

// ✅ Отображение матчей
function displayMatches(matches) {
    const container = document.getElementById('matchesContainer');
    container.innerHTML = '';

    if (matches.length === 0) {
        container.innerText = 'Матчи не найдены.';
        return;
    }

    matches.forEach(match => {
        const matchDiv = document.createElement('div');
        matchDiv.className = 'match-item';

        matchDiv.innerHTML = `
            <p>Матч ${match.round} - ID: ${match.id}</p>
            <p>Команды: ${match.team1_name} vs ${match.team2_name}</p>
            <p>Текущий счет: ${match.score1 || 0} - ${match.score2 || 0}</p>
            <p>Статус: ${match.status}</p>
        `;

        container.appendChild(matchDiv);
    });
}
