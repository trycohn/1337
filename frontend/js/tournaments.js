document.addEventListener('DOMContentLoaded', () => {
  loadMyTournaments();
});

async function loadMyTournaments() {
  try {
      const token = localStorage.getItem('jwtToken');
      if (!token) {
          throw new Error('Нет токена в localStorage. Пожалуйста, войдите в систему.');
      }

      const response = await fetch('http://localhost:3000/api/tournaments/myTournaments', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
          }
      });

      if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ошибка загрузки турниров (статус: ${response.status}): ${errorText}`);
      }

      const data = await response.json();
      displayMyTournaments(data);
  } catch (error) {
      console.error('Ошибка загрузки турниров:', error);
      const container = document.getElementById('myTournamentsContainer');
      if (container) {
          container.innerText = `Не удалось загрузить турниры: ${error.message}`;
      }
  }
}

function displayMyTournaments(tournaments) {
  const container = document.getElementById('myTournamentsContainer');
  if (!container) {
      console.error('Контейнер myTournamentsContainer не найден в DOM');
      return;
  }
  container.innerHTML = '';
  if (!Array.isArray(tournaments) || tournaments.length === 0) {
      container.innerText = 'Нет доступных турниров.';
      return;
  }
  const list = document.createElement('ul');
  tournaments.forEach(t => {
      const listItem = document.createElement('li');
      listItem.textContent = `${t.name} [${t.game}] - статус: ${t.status}`;
      list.appendChild(listItem);
  });
  container.appendChild(list);
}