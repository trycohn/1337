/**
 * tournaments.js
 *
 * Этот файл отвечает за загрузку турниров для текущего пользователя ("Мои турниры")
 * и их отображение на странице.
 *
 * Теперь названия турниров выводятся как ссылки с data-screen="admin",
 * чтобы при клике переключалась секция управления турниром.
 */

function getTournamentsContainer() {
  let container = document.getElementById('myTournamentsContainer');
  if (!container) {
      console.error("Элемент с id 'myTournamentsContainer' не найден. Создаем новый контейнер.");
      container = document.createElement('div');
      container.id = 'myTournamentsContainer';
      document.body.appendChild(container);
  }
  return container;
}

function displayTournaments(tournaments) {
  const tournamentsContainer = getTournamentsContainer();
  tournamentsContainer.innerHTML = ''; // Очищаем содержимое

  tournaments.forEach(tournament => {
      const tournamentDiv = document.createElement('div');
      tournamentDiv.classList.add('tournament-item');

      // Создаем ссылку для управления турниром с явным указанием tournamentId
      const link = document.createElement('a');
      link.href = `/admin?tournamentId=${tournament.id}`;
      link.textContent = tournament.name;
      // Добавляем data-атрибут для SPA-роутинга
      link.dataset.screen = "admin";

      tournamentDiv.appendChild(link);
      tournamentsContainer.appendChild(tournamentDiv);
  });
}

async function loadMyTournaments() {
  console.log('Отправка запроса к:', '/api/tournaments/myTournaments');
  const token = localStorage.getItem('jwtToken');
  try {
      const response = await fetch('/api/tournaments/myTournaments', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ошибка сервера');
      console.log('Мои турниры:', data.tournaments);
  } catch (error) {
      console.error('Ошибка загрузки турниров:', error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMyTournaments();
});
