/*
 * Файл: tournamentAdmin.js
 * Описание: Загружает список турниров, где пользователь является администратором или создателем.
 * Позволяет редактировать турниры и управлять матчами.
 */

document.addEventListener('DOMContentLoaded', () => {
  loadMyTournaments();
  loadTournamentInfo();
  loadMatches();
});

// ✅ Получение списка турниров, где пользователь администратор или создатель
async function loadMyTournaments() {
  try {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      console.error('Нет токена в localStorage');
      return;
    }

    const response = await fetch('http://localhost:3000/api/tournaments/myTournaments', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки турниров (статус: ${response.status})`);
    }

    const data = await response.json();
    displayMyTournaments(data.tournaments);
  } catch (error) {
    console.error('Ошибка загрузки турниров:', error);
    document.getElementById('myTournamentsContainer').innerText = 'Не удалось загрузить турниры.';
  }
}

// ✅ Отображение списка турниров в DOM
function displayMyTournaments(tournaments) {
  const container = document.getElementById('myTournamentsContainer');
  container.innerHTML = '';
  if (tournaments.length === 0) {
    container.innerText = 'Нет доступных турниров.';
    return;
  }
  const list = document.createElement('ul');
  tournaments.forEach(t => {
    const listItem = document.createElement('li');
    const link = document.createElement('a');
    link.href = `tournamentAdmin.html?id=${t.id}`;
    link.textContent = `${t.name} [${t.game}] - статус: ${t.status}`;
    listItem.appendChild(link);
    list.appendChild(listItem);
  });
  container.appendChild(list);
}

// ✅ Получение ID турнира из URL
function getTournamentIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// ✅ Загрузка информации о турнире
async function loadTournamentInfo() {
  const tournamentId = getTournamentIdFromUrl();
  if (!tournamentId) {
    console.error('ID турнира не найден в URL.');
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}`);
    if (!response.ok) {
      throw new Error(`Ошибка при загрузке турнира (статус: ${response.status})`);
    }

    const data = await response.json();
    displayTournamentInfo(data.tournament);
  } catch (error) {
    console.error('Ошибка при загрузке турнира:', error);
    document.getElementById('tournamentInfo').innerText = 'Ошибка при загрузке турнира.';
  }
}

// ✅ Отображение информации о турнире в DOM
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

// ✅ Загрузка матчей турнира
async function loadMatches() {
  const tournamentId = getTournamentIdFromUrl();
  if (!tournamentId) return;

  try {
    const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}`);
    if (!response.ok) throw new Error('Ошибка при загрузке матчей');

    const data = await response.json();
    displayMatches(data.matches);
  } catch (error) {
    console.error('Ошибка при загрузке матчей:', error);
    document.getElementById('matchesContainer').innerText = 'Не удалось загрузить матчи.';
  }
}

// ✅ Отображение списка матчей турнира
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
      <p>Команды: ${match.team1_id} vs ${match.team2_id}</p>
      <p>Текущий счет: ${match.score1 || 0} - ${match.score2 || 0}</p>
    `;
    
    container.appendChild(matchDiv);
  });
}

