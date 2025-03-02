/**
 * frontend/js/tournamentAdmin.js
 *
 * Этот файл отвечает за администрирование турнира:
 * 1. Если в URL указан конкретный турнир, сразу загружаются его детали,
 *    список участников, матчей и т.д.
 * 2. Если турнир не выбран, загружается общий список турниров ("Мои турниры").
 * 3. При выборе турнира обновляются его детали, создаётся скрытое поле с его ID,
 *    а также загружается актуальный список участников, матчей и т.д.
 * 4. На странице турнира есть форма для добавления участников, кнопка "Сформировать сетку"
 *    и кнопка "Назад к списку турниров".
 *
 * Изменения:
 * – Автообновление списка участников теперь происходит раз в 15 секунд (15000 мс).
 */

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentIdFromUrl = urlParams.get('id') || urlParams.get('tournamentId');

    if (tournamentIdFromUrl) {
        window.currentTournamentId = tournamentIdFromUrl;
        console.log('Установлен currentTournamentId из URL:', tournamentIdFromUrl);
        const details = document.getElementById('tournamentDetails');
        if (details) details.style.display = 'block';
        const tournamentsList = document.getElementById('myTournamentsContainer');
        if (tournamentsList) tournamentsList.style.display = 'none';
        // Удаляем старый контейнер участников и создаём новый
        resetParticipantContainer();
        // Устанавливаем интервал обновления участников для турнира из URL
        setParticipantInterval(tournamentIdFromUrl);
        setTimeout(() => {
            loadTournamentDetails(tournamentIdFromUrl);
            loadParticipants(tournamentIdFromUrl);
            loadParticipantsOrTeams(tournamentIdFromUrl);
            loadMatches(tournamentIdFromUrl);
        }, 100);
    } else {
        loadMyTournaments();
    }

    // Форма добавления участника
    let addParticipantForm = document.getElementById('addParticipantForm');
    if (!addParticipantForm) {
        addParticipantForm = document.createElement('form');
        addParticipantForm.id = 'addParticipantForm';
        addParticipantForm.innerHTML = `
            <h4>Добавить участника турнира</h4>
            <input type="text" id="participantName" placeholder="Имя участника" required />
            <button type="submit">Добавить участника</button>
            <div id="participantAddStatus"></div>
        `;
        const details = document.getElementById('tournamentDetails');
        if (details) {
            details.appendChild(addParticipantForm);
        } else {
            document.getElementById('screen-admin').appendChild(addParticipantForm);
        }
    }
    addParticipantForm.addEventListener('submit', addParticipant);

    // Кнопка генерации сетки
    let generateBracketButton = document.getElementById('generateBracketButton');
    if (!generateBracketButton) {
        generateBracketButton = document.createElement('button');
        generateBracketButton.id = 'generateBracketButton';
        generateBracketButton.innerText = 'Сформировать сетку';
        document.getElementById('screen-admin').appendChild(generateBracketButton);
    }
    generateBracketButton.addEventListener('click', generateBracket);

    // Кнопка "Назад к списку турниров"
    let backToListButton = document.getElementById('backToListButton');
    if (!backToListButton) {
        backToListButton = document.createElement('button');
        backToListButton.id = 'backToListButton';
        backToListButton.innerText = 'Назад к списку турниров';
        const adminSection = document.getElementById('screen-admin');
        adminSection.insertBefore(backToListButton, adminSection.firstChild);
    }
    backToListButton.addEventListener('click', () => {
        const details = document.getElementById('tournamentDetails');
        if (details) details.style.display = 'none';
        const tournamentsList = document.getElementById('myTournamentsContainer');
        if (tournamentsList) tournamentsList.style.display = 'block';
        const header = document.getElementById('tournamentHeader');
        if (header) header.textContent = 'Мои турниры';
        backToListButton.style.display = 'none';
        window.currentTournamentId = null;
        window.entityMap = {};
        const hiddenInput = document.getElementById('currentTournamentIdInput');
        if (hiddenInput) hiddenInput.remove();
        console.log('Вернулись к списку турниров, window.currentTournamentId сброшен.');
    });
});

// Функция для установки интервала обновления списка участников (изменено: 15000 мс вместо 5000)
function setParticipantInterval(tournamentId) {
    if (window.participantInterval) {
        clearInterval(window.participantInterval);
    }
    window.participantInterval = setInterval(() => {
        console.log('Автообновление списка участников для турнира', tournamentId);
        loadParticipants(tournamentId);
        loadParticipantsOrTeams(tournamentId);
    }, 15000); // Изменено: интервал 15000 мс (15 секунд)
}

// Функция для удаления и создания нового контейнера списка участников.
function resetParticipantContainer() {
    let oldContainer = document.getElementById('participantListContainer');
    if (oldContainer) {
        oldContainer.innerHTML = '';
    }
    return ensureParticipantContainer();
}

// Функция для гарантированного получения контейнера списка участников.
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

// Функция для гарантированного получения контейнера для матчей.
function ensureBracketContainer() {
    let container = document.getElementById('bracketContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'bracketContainer';
        const adminSection = document.getElementById('screen-admin');
        if (adminSection) {
            adminSection.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    }
    return container;
}

// ============================
// 1) Загрузка списка турниров ("Мои турниры")
// ============================
async function loadMyTournaments() {
    try {
        const response = await fetch('/api/tournaments/myTournaments', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
            },
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`Ошибка загрузки турниров: ${response.status}`);
        }
        const data = await response.json();
        displayMyTournaments(data.tournaments);
    } catch (error) {
        console.error('Ошибка загрузки турниров:', error);
        const container = document.getElementById('myTournamentsContainer');
        if (container) container.innerText = 'Ошибка загрузки турниров.';
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
        const tournamentDiv = document.createElement('div');
        tournamentDiv.classList.add('tournament-item');
        // Создаем ссылку для управления турниром с явным указанием tournamentId
        const link = document.createElement('a');
        link.href = `/admin?tournamentId=${tournament.id}`;
        link.textContent = tournament.name;
        link.dataset.screen = "admin";
        tournamentDiv.appendChild(link);
        container.appendChild(tournamentDiv);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadMyTournaments();
});

// ============================
// 2) Выбор турнира и отображение его деталей
// ============================
function selectTournament(tournament) {
    if (window.participantInterval) {
        clearInterval(window.participantInterval);
        window.participantInterval = null;
    }
    window.currentTournamentId = tournament.id;
    window.entityMap = {};
    console.log('Выбран турнир:', tournament.id);
    const details = document.getElementById('tournamentDetails');
    if (details) details.style.display = 'block';
    const tournamentsList = document.getElementById('myTournamentsContainer');
    if (tournamentsList) tournamentsList.style.display = 'none';
    const backButton = document.getElementById('backToListButton');
    if (backButton) backButton.style.display = 'inline-block';
    const titleEl = document.getElementById('tournamentTitle');
    if (titleEl) titleEl.textContent = tournament.name;
    let hiddenInput = document.getElementById('currentTournamentIdInput');
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.id = 'currentTournamentIdInput';
        document.getElementById('tournamentDetails').appendChild(hiddenInput);
    }
    hiddenInput.value = tournament.id;
    const addParticipantForm = document.getElementById('addParticipantForm');
    if (addParticipantForm && details) {
        details.appendChild(addParticipantForm);
    }
    resetParticipantContainer();
    const bracketContainer = ensureBracketContainer();
    bracketContainer.innerHTML = '';
    setParticipantInterval(tournament.id);
    setTimeout(() => {
        loadParticipants(tournament.id);
        loadParticipantsOrTeams(tournament.id);
        loadMatches(tournament.id);
    }, 100);
}

// ============================
// 3) Загрузка списка участников (solo)
// ============================
async function loadParticipants(tournamentId) {
    try {
        console.log('Загрузка участников для турнира ID:', tournamentId);
        const response = await fetch(`/api/tournaments/${tournamentId}/participants?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error('Ошибка загрузки участников');
        }
        const data = await response.json();
        console.log('Полученные участники:', data.participants);
        displayParticipants(data.participants);
    } catch (error) {
        console.error('Ошибка загрузки участников:', error);
        const container = document.getElementById('participantListContainer');
        if (container) container.innerText = 'Ошибка загрузки участников.';
    }
}

function displayParticipants(participants) {
    const container = ensureParticipantContainer();
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
// 4) Загрузка участников в entityMap
// ============================
async function loadParticipantsOrTeams(tournamentId) {
    try {
        const resp = await fetch(`/api/tournaments/${tournamentId}/participants?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store'
        });
        if (!resp.ok) {
            throw new Error('Ошибка загрузки участников/команд');
        }
        const data = await resp.json();
        if (!window.entityMap || typeof window.entityMap !== 'object') {
            window.entityMap = {};
        }
        if (!data.participants || !Array.isArray(data.participants)) {
            console.error('Участники не получены или формат данных неверный:', data);
            return;
        }
        data.participants.forEach(p => {
            window.entityMap[p.id] = p.name;
        });
        console.log('Обновленная entityMap:', window.entityMap);
    } catch (error) {
        console.error(error);
    }
}

// ============================
// 5) Добавление участника
// ============================
async function addParticipant(e) {
    e.preventDefault();
    let tournamentId = window.currentTournamentId;
    if (!tournamentId) {
        const hiddenInput = document.getElementById('currentTournamentIdInput');
        if (hiddenInput) {
            tournamentId = hiddenInput.value;
            window.currentTournamentId = tournamentId;
        }
    }
    console.log('Попытка добавить участника для турнира:', tournamentId);
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
        const response = await fetch(`/api/tournaments/${tournamentId}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: participantName }),
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error('Ошибка добавления участника');
        }
        alert('Участник добавлен!');
        document.getElementById('participantName').value = '';
        loadParticipants(tournamentId);
        loadParticipantsOrTeams(tournamentId);
    } catch (error) {
        alert(error.message);
    }
}

// ============================
// 6) Генерация сетки турнира
// ============================
async function generateBracket() {
    const tournamentId = window.currentTournamentId;
    if (!tournamentId) {
        alert('Сначала выберите турнир.');
        return;
    }

    // Проверяем наличие токена
    const token = localStorage.getItem('jwtToken');
    if (!token) {
        alert('Необходима авторизация. Пожалуйста, войдите в систему.');
        return;
    }

    const withThirdPlace = document.getElementById('thirdPlaceCheckbox')?.checked || false;
    
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/generateBracket`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ withThirdPlace }),
            credentials: 'include', // Добавляем для передачи куки
            cache: 'no-store'
        });

        if (response.status === 403) {
            alert('У вас нет прав для генерации сетки турнира. Пожалуйста, проверьте авторизацию.');
            return;
        }

        if (!response.ok) {
            throw new Error(`Ошибка генерации сетки: ${response.status}`);
        }

        alert('Сетка успешно сгенерирована!');
        const bracketContainer = ensureBracketContainer();
        bracketContainer.innerHTML = '';
        loadMatches(tournamentId);
    } catch (error) {
        console.error('Ошибка при генерации сетки:', error);
        alert('Ошибка при генерации сетки. Проверьте консоль для деталей.');
    }
}

// ============================
// 7) Загрузка матчей турнира
// ============================
async function loadMatches(tournamentId) {
    try {
        const response = await fetch(`/api/tournaments/${tournamentId}/matches`, {
            method: 'GET',
            cache: 'no-store'
        });
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
// 8) Отрисовка сетки (матчей)
// ============================
function drawBracket(matches) {
    const bracketContainer = ensureBracketContainer();
    bracketContainer.innerHTML = '';
    if (!matches || matches.length === 0) {
        bracketContainer.textContent = 'Матчи не найдены.';
        return;
    }
    matches.sort((a, b) => a.id - b.id);
    const rounds = {};
    matches.forEach(m => {
        if (!rounds[m.round]) {
            rounds[m.round] = [];
        }
        rounds[m.round].push(m);
    });
    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
    roundNumbers.forEach(rnd => {
        const roundArr = rounds[rnd];
        roundArr.sort((a, b) => a.id - b.id);
        const roundDiv = document.createElement('div');
        roundDiv.classList.add('round-column');
        const roundTitle = document.createElement('h4');
        roundTitle.textContent = `Раунд ${rnd}`;
        roundDiv.appendChild(roundTitle);
        roundArr.forEach(match => {
            const matchDiv = document.createElement('div');
            matchDiv.classList.add('match-item');
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

// ============================
// 9) Получение имени участника по ID из глобальной entityMap
// ============================
function resolveEntityName(entityId) {
    if (!entityId) return '---';
    if (entityId < 0) {
        return `Победитель пары #${-entityId}`;
    }
    if (window.entityMap && window.entityMap[entityId]) {
        return window.entityMap[entityId];
    }
    return `Участник ID=${entityId}`;
}
