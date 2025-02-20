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
            // Скрываем детали, показываем список моих турниров
            document.getElementById('tournamentDetails').style.display = 'none';
            document.getElementById('myTournamentsContainer').style.display = 'block';
            document.getElementById('tournamentHeader').textContent = 'Мои турниры';
            backToListButton.style.display = 'none';

            // Сбрасываем глобальные переменные
            window.currentTournamentId = null;
            window.entityMap = {}; 
        });
    }
});

// ============================
// 1) Загрузка "Мои турниры"
// ============================
async function loadMyTournaments() {
    try {
        const response = await fetch('http://localhost:3000/api/tournaments/myTournaments', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            }
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
    tournaments.forEach(t => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = "#";
        link.textContent = `${t.name} [${t.game}] - статус: ${t.status}`;
        // При клике выбираем турнир
        link.addEventListener('click', () => selectTournament(t));

        li.appendChild(link);
        list.appendChild(li);
    });
    container.appendChild(list);
}

// ============================
// 2) Выбор турнира
// ============================
function selectTournament(tournament) {
    window.currentTournamentId = tournament.id;
    window.entityMap = {}; // ID -> name

    // Показываем детали турнира
    document.getElementById('tournamentDetails').style.display = 'block';
    document.getElementById('myTournamentsContainer').style.display = 'none';

    const backButton = document.getElementById('backToListButton');
    if (backButton) backButton.style.display = 'inline-block';

    document.getElementById('tournamentTitle').textContent = tournament.name;

    // 2.1) Загрузим список участников (отобразим над сеткой)
    loadParticipants(tournament.id);

    // 2.2) Загрузим участников/команды в entityMap (для отображения имён в сетке)
    loadParticipantsOrTeams(tournament.id);

    // 2.3) Очищаем сетку, потом грузим матчи
    document.getElementById('bracketContainer').innerHTML = '';
    loadMatches(tournament.id);
}

// ============================
// 3) Загрузка списка участников (solo) для отображения над сеткой
// ============================
async function loadParticipants(tournamentId) {
    try {
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
// 4) Загрузка участников (solo) / команд (teams) в entityMap
// ============================
async function loadParticipantsOrTeams(tournamentId) {
    try {
        const resp = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/participants`);
        if (!resp.ok) {
            throw new Error('Ошибка загрузки участников/команд');
        }
        const data = await resp.json();
        data.participants.forEach(p => {
            window.entityMap[p.id] = p.name;
        });
    } catch (error) {
        console.error(error);
    }
}

// ============================
// 5) Добавление одного участника
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
        // Обновим список участников и entityMap
        loadParticipants(tournamentId);
        loadParticipantsOrTeams(tournamentId);
    } catch (error) {
        alert(error.message);
    }
}

// ============================
// 6) Генерация сетки
// ============================
async function generateBracket() {
    const tournamentId = window.currentTournamentId;
    if (!tournamentId) {
        alert('Сначала выберите турнир.');
        return;
    }

    const withThirdPlace = document.getElementById('thirdPlaceCheckbox')?.checked || false;

    try {
        const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/generateBracket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ withThirdPlace })
        });

        if (!response.ok) {
            throw new Error(`Ошибка генерации сетки: ${response.status}`);
        }

        alert('Сетка успешно сгенерирована!');
        // Перерисовать сетку
        document.getElementById('bracketContainer').innerHTML = '';
        loadMatches(tournamentId);

    } catch (error) {
        alert(error.message);
    }
}

// ============================
// 7) Загрузка матчей
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
        console.error(error);
        alert(error.message);
    }
}

// ============================
// 8) Отрисовка сетки
// ============================
function drawBracket(matches) {
    const bracketContainer = document.getElementById('bracketContainer');
    bracketContainer.innerHTML = ''; // Очищаем

    if (!matches || matches.length === 0) {
        bracketContainer.textContent = 'Матчи не найдены.';
        return;
    }

    // 1) Сортируем матчи по id, чтобы иметь предсказуемый порядок
    matches.sort((a, b) => a.id - b.id);

    // 2) Группируем по round
    const rounds = {};
    let maxRound = 0;
    matches.forEach(m => {
        if (!rounds[m.round]) {
            rounds[m.round] = [];
        }
        rounds[m.round].push(m);

        if (m.round > maxRound) {
            maxRound = m.round;
        }
    });

    // Сортируем список раундов по возрастанию
    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);

    // 3) Для каждого раунда делаем свою «колонку»
    roundNumbers.forEach(rnd => {
        const roundArr = rounds[rnd];
        // Можно отсортировать внутри раунда по id
        roundArr.sort((a, b) => a.id - b.id);

        // Создаём div-колонку
        const roundDiv = document.createElement('div');
        roundDiv.classList.add('round-column');

        // Опционально, как-то называем раунд:
        const roundTitle = document.createElement('h4');
        roundTitle.textContent = `Раунд ${rnd}`; // или более сложная логика (Финал, Полуфинал...)
        roundDiv.appendChild(roundTitle);

        // 4) Для каждого матча — делаем блок
        roundArr.forEach(match => {
            const matchDiv = document.createElement('div');
            matchDiv.classList.add('match-item');

            // team1_id, team2_id => преобразуем в имена/«Победитель пары #X»
            const team1Text = resolveEntityName(match.team1_id);
            const team2Text = resolveEntityName(match.team2_id);

            matchDiv.innerHTML = `
                <p><strong>Пара #${match.id}</strong></p>
                <p>${team1Text}</p>
                <p>${team2Text}</p>
                <p>Статус: ${match.status}</p>
            `;

            roundDiv.appendChild(matchDiv);
        });

        bracketContainer.appendChild(roundDiv);
    });
}
function resolveEntityName(entityId) {
    if (!entityId) return '---';

    // Если <0 => "Победитель пары #|id|"
    if (entityId < 0) {
        return `Победитель пары #${-entityId}`;
    }

    // Если >0 => ищем в entityMap
    if (window.entityMap && window.entityMap[entityId]) {
        return window.entityMap[entityId];
    }
    return `Участник ID=${entityId}`;
}

