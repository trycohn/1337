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
  try {
      const response = await fetch('/api/tournaments');
      console.log("Запрошенный URL:", response.url, "Статус:", response.status);

      if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      console.log("Тип содержимого ответа:", contentType);

      if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          throw new Error(`Expected JSON, but received: ${text.substring(0, 100)}...`);
      }

      const tournaments = await response.json();
      displayTournaments(tournaments);
  } catch (error) {
      console.error("Ошибка загрузки турниров:", error);
      const tournamentsContainer = getTournamentsContainer();
      tournamentsContainer.innerHTML = '<p>Ошибка загрузки турниров. Попробуйте позже.</p>';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMyTournaments();
});
