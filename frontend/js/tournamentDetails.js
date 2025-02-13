// js/tournamentDetails.js

// Функция для получения параметра id из URL
function getTournamentIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }
  
  // Функция для загрузки деталей турнира
  async function loadTournamentDetails() {
    const tournamentId = getTournamentIdFromUrl();
    if (!tournamentId) {
      document.getElementById('tournamentDetails').innerText = 'ID турнира не указан.';
      return;
    }
    try {
      // Запрашиваем подробности турнира
      const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}`);
      if (!response.ok) throw new Error('Ошибка при загрузке деталей турнира');
      const data = await response.json();
      displayTournamentDetails(data.tournament);
    } catch (error) {
      console.error('Ошибка:', error);
      document.getElementById('tournamentDetails').innerText = 'Не удалось загрузить данные турнира.';
    }
  }
  
  // Функция для загрузки статистики турнира
  async function loadTournamentStatistics() {
    const tournamentId = getTournamentIdFromUrl();
    if (!tournamentId) return;
    try {
      const response = await fetch(`http://localhost:3000/api/tournaments/${tournamentId}/statistics`);
      if (!response.ok) throw new Error('Ошибка при загрузке статистики турнира');
      const data = await response.json();
      displayStatistics(data);
    } catch (error) {
      console.error('Ошибка:', error);
      document.getElementById('statistics').innerText = 'Не удалось загрузить статистику турнира.';
    }
  }
  
  // Функция для отображения деталей турнира
  function displayTournamentDetails(tournament) {
    const container = document.getElementById('tournamentDetails');
    container.innerHTML = `
      <h2>${tournament.name}</h2>
      <p><strong>Описание:</strong> ${tournament.description || 'Нет описания'}</p>
      <p><strong>Игра:</strong> ${tournament.game}</p>
      <p><strong>Статус:</strong> ${tournament.status}</p>
      <p><strong>Создан:</strong> ${new Date(tournament.created_at).toLocaleString()}</p>
    `;
  }
  
  // Функция для отображения статистики турнира
  function displayStatistics(data) {
    const statsContainer = document.getElementById('statistics');
    const { teamWins, playerStats } = data;
    let html = '<h3>Статистика команд</h3>';
    if (teamWins.length > 0) {
      html += '<ul>';
      teamWins.forEach(win => {
        html += `<li>Команда с ID ${win.team_id} – Побед: ${win.wins}</li>`;
      });
      html += '</ul>';
    } else {
      html += '<p>Нет данных о победах команд.</p>';
    }
    html += '<h3>Статистика игроков</h3>';
    if (playerStats.length > 0) {
      html += '<ul>';
      playerStats.forEach(ps => {
        html += `<li>${ps.player_name}: Очки – ${ps.total_points}, Передачи – ${ps.total_assists}, Подборы – ${ps.total_rebounds}</li>`;
      });
      html += '</ul>';
    } else {
      html += '<p>Нет данных по статистике игроков.</p>';
    }
    statsContainer.innerHTML = html;
  }
  
  // При загрузке страницы запускаем обе функции
  document.addEventListener('DOMContentLoaded', () => {
    loadTournamentDetails();
    loadTournamentStatistics();
  });
  