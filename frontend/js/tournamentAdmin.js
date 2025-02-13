/*
 * Файл: tournamentAdmin.js
 * Описание: Административная панель турнира для редактирования сведений о турнире,
 * обновления результатов матчей, управления составами команд, а также
 * отображения списка турниров, в которых пользователь является создателем или администратором.
 */

// При загрузке страницы сразу запускаем загрузку списка "моих" турниров,
// сведений о выбранном турнире и списка матчей.
document.addEventListener('DOMContentLoaded', () => {
    loadMyTournaments();  // новый блок — список турниров для текущего пользователя
    loadTournamentInfo();
    loadMatches();
  });
  
  // Функция для получения параметра id турнира из URL
  function getTournamentIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }
  
  // ================================
  // Новый раздел: Загрузка и отображение "моих" турниров
  // ================================
  async function loadMyTournaments() {
    const container = document.getElementById('myTournamentsContainer');
    if (!container) return; // Если контейнер не найден, пропускаем
    container.innerHTML = 'Загрузка ваших турниров...';
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch('http://localhost:3000/api/myTournaments', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Ошибка загрузки турниров');
      const data = await response.json();
      displayMyTournaments(data.tournaments);
    } catch (error) {
      console.error(error);
      container.innerText = 'Не удалось загрузить список ваших турниров.';
    }
  }
  
  function displayMyTournaments(tournaments) {
    const container = document.getElementById('myTournamentsContainer');
    container.innerHTML = '';
    if (tournaments.length === 0) {
      container.innerText = 'Нет турниров, где вы являетесь создателем или администратором.';
      return;
    }
    const list = document.createElement('ul');
    tournaments.forEach(t => {
      const li = document.createElement('li');
      // Создаем ссылку на страницу редактирования турнира.
      const editLink = document.createElement('a');
      editLink.href = `tournamentAdmin.html?id=${t.id}`;
      editLink.textContent = t.name;
      li.appendChild(editLink);
      li.innerHTML += ` — Статус: ${t.status}`;
      list.appendChild(li);
    });
    container.appendChild(list);
  }
  
  // ================================
  // Секция: Загрузка сведений о выбранном турнире и его матчей
  // ================================
  
  async function loadTournamentInfo() {
    const tournamentId = getTournamentIdFromUrl();
    if (!tournamentId) {
      document.getElementById('tournamentInfo').innerText = 'ID турнира не указан.';
      return;
    }
    try {
      const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}`);
      if (!response.ok) throw new Error('Ошибка при загрузке турнира');
      const data = await response.json();
      // Сохраняем список команд, зарегистрированных в турнире, для дальнейшего использования
      window.tournamentTeams = data.teams; // каждый объект должен содержать tournament_team_id и name
      displayTournamentInfo(data.tournament);
    } catch (error) {
      console.error(error);
      document.getElementById('tournamentInfo').innerText = 'Не удалось загрузить сведения о турнире.';
    }
  }
  
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
  
  async function loadMatches() {
    const tournamentId = getTournamentIdFromUrl();
    if (!tournamentId) return;
    try {
      const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}`);
      if (!response.ok) throw new Error('Ошибка при загрузке матчей');
      const data = await response.json();
      displayMatches(data.matches);
    } catch (error) {
      console.error(error);
      document.getElementById('matchesContainer').innerText = 'Не удалось загрузить матчи.';
    }
  }
  
  function displayMatches(matches) {
    const container = document.getElementById('matchesContainer');
    container.innerHTML = '';
    if (matches.length === 0) {
      container.innerText = 'Матчи не найдены.';
      return;
    }
    matches.forEach(match => {
      // Для каждой команды получаем имя из глобального массива window.tournamentTeams
      const team1Name = (() => {
        if (!window.tournamentTeams) return match.team1_id;
        const teamObj = window.tournamentTeams.find(t => t.tournament_team_id === match.team1_id);
        return teamObj ? teamObj.name : match.team1_id;
      })();
      const team2Name = (() => {
        if (!window.tournamentTeams) return match.team2_id;
        const teamObj = window.tournamentTeams.find(t => t.tournament_team_id === match.team2_id);
        return teamObj ? teamObj.name : match.team2_id;
      })();
      
      const matchDiv = document.createElement('div');
      matchDiv.className = 'match-item';
      
      // Формируем выпадающий список для выбора победителя,
      // где каждая option содержит атрибут data-id с tournament_team_id
      matchDiv.innerHTML = `
        <p>Матч ${match.round} - ID: ${match.id}</p>
        <p>Команды: ${team1Name} vs ${team2Name}</p>
        <p>Текущий счет: ${match.score1 || 0} - ${match.score2 || 0}</p>
        <label>Счет команды 1: <input type="number" id="score1-${match.id}" value="${match.score1 || 0}"></label>
        <label>Счет команды 2: <input type="number" id="score2-${match.id}" value="${match.score2 || 0}"></label>
        <label>Победитель:
          <select id="winner-${match.id}">
            <option value="">-- Выбрать команду --</option>
            <option value="${team1Name}" data-id="${match.team1_id}">${team1Name}</option>
            <option value="${team2Name}" data-id="${match.team2_id}">${team2Name}</option>
          </select>
        </label>
        <button onclick="updateMatch(${match.id})">Сохранить результат</button>
        <hr>
      `;
      container.appendChild(matchDiv);
    });
  }
  
  async function updateMatch(matchId) {
    const score1 = document.getElementById(`score1-${matchId}`).value;
    const score2 = document.getElementById(`score2-${matchId}`).value;
    const winnerSelect = document.getElementById(`winner-${matchId}`);
    const selectedOption = winnerSelect.options[winnerSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.getAttribute('data-id')) {
      alert("Пожалуйста, выберите победителя.");
      return;
    }
    
    const winner_team_id = Number(selectedOption.getAttribute('data-id'));
    
    console.log(`Updating match ${matchId}: score1=${score1}, score2=${score2}, winner_team_id=${winner_team_id}`);
    
    try {
      const token = localStorage.getItem('jwtToken');
      const response = await fetch(`http://localhost:3000/api/matches/${matchId}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          score1: Number(score1),
          score2: Number(score2),
          winner_team_id: winner_team_id
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ошибка обновления матча ${matchId}: ${response.status} ${errorText}`);
        throw new Error('Ошибка обновления матча');
      }
      
      const data = await response.json();
      alert(`Матч ${matchId} обновлен успешно.`);
      loadMatches();
    } catch (error) {
      console.error(error);
      alert(`Ошибка обновления матча ${matchId}.`);
    }
  }
  