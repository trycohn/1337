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
 * Особенности:
 * – Автообновление списка участников происходит каждые 15 секунд (15000 мс).
 */

import { generateBracket } from './bracketUtils.js';
import { loadAndDisplayTournamentDetails, loadAndDisplayParticipants } from './tournamentDetails.js';

// Вспомогательные функции
function setParticipantInterval(tournamentId) {
    if (window.participantInterval) {
        clearInterval(window.participantInterval);
    }
    window.participantInterval = setInterval(() => {
        console.log('Автообновление списка участников для турнира', tournamentId);
        loadAndDisplayParticipants(tournamentId);
    }, 15000); // Интервал 15 секунд
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

// Основной блок кода, выполняемый после загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    // Кнопка "Назад к списку турниров"
    let backToListButton = document.getElementById('backToListButton');
    if (!backToListButton) {
        backToListButton = document.createElement('button');
        backToListButton.id = 'backToListButton';
        backToListButton.innerText = 'Назад к списку турниров';
        const adminSection = document.getElementById('screen-admin');
        if (!adminSection) {
            console.error('Секция screen-admin не найдена');
            return;
        }
        adminSection.insertBefore(backToListButton, adminSection.firstChild);
    }
    backToListButton.addEventListener('click', () => {
        const details = document.getElementById('tournamentDetails');
        if (details) details.style.display = 'none';
        const tournamentsList = document.getElementById('myTournamentsContainer');
        if (tournamentsList) tournamentsList.style.display = 'block';
        backToListButton.style.display = 'none';
        window.currentTournamentId = null;
        window.entityMap = {};
        const hiddenInput = document.getElementById('currentTournamentIdInput');
        if (hiddenInput) hiddenInput.remove();
        console.log('Вернулись к списку турниров, window.currentTournamentId сброшен.');
        updateGenerateBracketButtonVisibility();
    });

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
    generateBracketButton.addEventListener('click', async () => {
        const tournamentId = window.currentTournamentId;
        if (!tournamentId) {
            alert('Сначала выберите турнир.');
            return;
        }
        try {
            await generateBracket(tournamentId);
            alert('Сетка успешно сгенерирована!');
            loadMatches(tournamentId);
        } catch (error) {
            alert(error.message);
        }
    });

    // Функция обновления видимости кнопки генерации сетки
    function updateGenerateBracketButtonVisibility() {
        if (window.currentTournamentId) {
            generateBracketButton.style.display = 'block';
            backToListButton.style.display = 'inline-block';
        } else {
            generateBracketButton.style.display = 'none';
            backToListButton.style.display = 'none';
        }
    }
    updateGenerateBracketButtonVisibility();

    // Логика загрузки данных при наличии tournamentId в URL
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentIdFromUrl = urlParams.get('id') || urlParams.get('tournamentId');

    if (tournamentIdFromUrl) {
        window.currentTournamentId = tournamentIdFromUrl;
        console.log('Установлен currentTournamentId из URL:', tournamentIdFromUrl);
        const details = document.getElementById('tournamentDetails');
        if (details) details.style.display = 'block';
        const tournamentsList = document.getElementById('myTournamentsContainer');
        if (tournamentsList) tournamentsList.style.display = 'none';
        resetParticipantContainer();
        setParticipantInterval(tournamentIdFromUrl);

        // Загружаем и отображаем детали турнира и участников
        await loadAndDisplayTournamentDetails(tournamentIdFromUrl);
        await loadAndDisplayParticipants(tournamentIdFromUrl);
        await loadMatches(tournamentIdFromUrl);

        updateGenerateBracketButtonVisibility();
    } else {
        loadMyTournaments();
    }
});

// Функция загрузки списка турниров ("Мои турниры")
async function loadMyTournaments() {
    console.log('Отправка запроса к:', '/api/tournaments/myTournaments');
    try {
        const token = localStorage.getItem('jwtToken');
        const response = await fetch('/api/tournaments/myTournaments', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
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

// Функция отображения списка турниров
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
        const link = document.createElement('a');
        link.href = `/admin?tournamentId=${tournament.id}`;
        link.textContent = tournament.name;
        link.dataset.screen = "admin";
        tournamentDiv.appendChild(link);
        container.appendChild(tournamentDiv);
    });
}

// Функция добавления участника
async function addParticipant(e) {
    e.preventDefault();
    let tournamentId = window.currentTournamentId;
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
        const token = localStorage.getItem('jwtToken');
        const response = await fetch(`/api/tournaments/${tournamentId}/participants`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name: participantName }), // userId и teamId добавляются опционально
            cache: 'no-store'
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Ошибка добавления участника: ${errorData.error}`);
        }
        alert('Участник добавлен!');
        document.getElementById('participantName').value = '';
        loadAndDisplayParticipants(tournamentId);
    } catch (error) {
        console.error('Ошибка:', error);
        alert(error.message);
    }
}
// Функция загрузки матчей турнира
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

// Функция отрисовки сетки (матчей)
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

// Функция получения имени участника по ID из глобальной entityMap
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

// Функция для проверки роли пользователя
async function checkUserRole() {
    try {
        const token = localStorage.getItem('jwtToken');
        const response = await fetch('/api/users/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const userData = await response.json();
        return userData.role;
    } catch (error) {
        console.error('Ошибка получения роли пользователя:', error);
        return null;
    }
}