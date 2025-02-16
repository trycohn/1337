document.addEventListener('DOMContentLoaded', () => {
    loadMyTournaments();

    // Форма добавления одного участника
    const addParticipantForm = document.getElementById('addParticipantForm');
    if (addParticipantForm) {
        addParticipantForm.addEventListener('submit', addParticipant);
    }

    // Кнопка генерации сетки
    const generateBracketButton = document.getElementById('generateBracketButton');
    if (generateBracketButton) {
        generateBracketButton.addEventListener('click', generateBracket);
    }

    // Кнопка "Назад к списку"
    const backToListButton = document.getElementById('backToListButton');
    if (backToListButton) {
        backToListButton.addEventListener('click', () => {
            document.getElementById('tournamentDetails').style.display = 'none';
            document.getElementById('myTournamentsContainer').style.display = 'block';
            document.getElementById('tournamentHeader').textContent = 'Мои турниры';
            backToListButton.style.display = 'none';
            window.currentTournamentId = null; // Сбрасываем ID при выходе
        });
    }
});

// ============================
// Загрузка "Мои турниры"
// ============================
async function loadMyTournaments() {
    try {
        const response = await fetch('http://localhost:3000/api/tournaments/myTournaments', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
        });

        if (!response.ok) {
            throw new Error(`Ошибка загрузки турниров: ${response.status}`);
        }

        const data = await response.json();
        displayMyTournaments(data.tournaments);
    } catch (error) {
        console.error('Ошибка загрузки турниров:', error);
        document.getElementById('myTournamentsContainer').innerText = 'Ошибка загрузки турниров.';
    }
}

function displayMyTournaments(tournaments) {
    const container = document.getElementById('myTournamentsContainer');
    container.innerHTML = '';

    if (!tournaments || tournaments.length === 0) {
        container.innerText = 'Нет доступных турниров.';
        return;
    }

    const list = document.createElement('ul');
    tournaments.forEach(tournament => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = "#";
        link.textContent = `${tournament.name} [${tournament.game}] - статус: ${tournament.status}`;
        link.addEventListener('click', () => selectTournament(tournament));

        li.appendChild(link);
        list.appendChild(li);
    });

    container.appendChild(list);
}

// ============================
// Выбор турнира из списка
// ============================
function selectTournament(tournament) {
    // Сохраняем ID выбранного турнира в глобальную переменную
    window.currentTournamentId = tournament.id;

    document.getElementById('tournamentHeader').textContent = tournament.name;
    document.getElementById('tournamentDetails').style.display = 'block';
    document.getElementById('myTournamentsContainer').style.display = 'none';

    const backButton = document.getElementById('backToListButton');
    if (backButton) backButton.style.display = 'inline-block';

    document.getElementById('tournamentTitle').textContent = tournament.name;

    loadParticipants(window.currentTournamentId);
    // При переходе сразу стираем старую сетку
    document.getElementById('bracketContainer').innerHTML = '';
}

// ============================
// Загрузка списка участников
// ============================
async function loadParticipants(tournamentId) {
    try {
        if (!tournamentId) {
            console.error('Не указан tournamentId при загрузке участников.');
            return;
        }

        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/participants`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки участников');
        }

        const data = await response.json();
        displayParticipants(data.participants);
    } catch (error) {
        console.error('Ошибка загрузки участников:', error);
        document.getElementById('participantListContainer').innerText = 'Ошибка загрузки участников.';
    }
}

function displayParticipants(participants) {
    const container = document.getElementById('participantListContainer');
    container.innerHTML = '';

    if (!participants || participants.length === 0) {
        container.innerText = 'Нет зарегистрированных участников.';
        return;
    }

    participants.forEach(participant => {
        const li = document.createElement('li');
        li.textContent = participant.name;
        container.appendChild(li);
    });
}

// ============================
// Добавление одного участника
// ============================
async function addParticipant(e) {
    e.preventDefault();

    const tournamentId = window.currentTournamentId;
    if (!tournamentId) {
        alert('Сначала выберите турнир.');
        return;
    }

    const participantName = document.getElementById('participantName').value.trim();
    if (!participantName) {
        alert('Введите имя участника');
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: participantName })
        });

        if (!response.ok) {
            throw new Error('Ошибка добавления участника');
        }

        alert('Участник добавлен!');
        document.getElementById('participantName').value = '';
        loadParticipants(tournamentId);
    } catch (error) {
        alert(error.message);
    }
}

// ============================
// Генерация сетки
// ============================
async function generateBracket() {
    const tournamentId = window.currentTournamentId;
    if (!tournamentId) {
        alert('Сначала выберите турнир.');
        return;
    }
    try {
        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/generateBracket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Ошибка генерации сетки: ${response.status}`);
        }

        alert('Сетка успешно сгенерирована!');

        // После генерации сетки загружаем все матчи
        loadMatches(tournamentId);

    } catch (error) {
        alert(error.message);
    }
}

// ============================
// Загрузка матчей турнира (GET /api/tournaments/:id/matches)
// ============================
async function loadMatches(tournamentId) {
    try {
        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/matches`);
        if (!response.ok) {
            throw new Error('Ошибка загрузки матчей');
        }

        const data = await response.json();
        drawBracket(data.matches);
    } catch (error) {
        alert(error.message);
    }
}

// ============================
// Рисуем турнирную сетку
// ============================
function drawBracket(matches) {
    const bracketContainer = document.getElementById('bracketContainer');
    bracketContainer.innerHTML = '';

    if (!matches || matches.length === 0) {
        bracketContainer.textContent = 'Матчи не найдены.';
        return;
    }

    // Группируем матчи по раундам
    const rounds = {};
    matches.forEach(match => {
        if (!rounds[match.round]) {
            rounds[match.round] = [];
        }
        rounds[match.round].push(match);
    });

    // Сортируем раунды по возрастанию
    const roundKeys = Object.keys(rounds).sort((a, b) => a - b);

    roundKeys.forEach(round => {
        const roundDiv = document.createElement('div');
        roundDiv.classList.add('round-column');
        roundDiv.innerHTML = `<h3>Раунд ${round}</h3>`;

        rounds[round].forEach(m => {
            const matchDiv = document.createElement('div');
            matchDiv.classList.add('match-item');

            // Формируем отображение
            matchDiv.innerHTML = `
                <p>Матч #${m.id}, Раунд: ${m.round}</p>
                <p>Участник 1 (ID: ${m.team1_id || '---'})</p>
                <p>Участник 2 (ID: ${m.team2_id || '---'})</p>
                <p>Статус: ${m.status}</p>
                <hr>
            `;
            roundDiv.appendChild(matchDiv);
        });

        bracketContainer.appendChild(roundDiv);
    });
}
