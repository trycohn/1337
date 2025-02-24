/**
 * /mnt/data/tournamentDetails.js
 * 
 * Этот файл отвечает за загрузку и отображение основных деталей турнира (заголовок, описание и т.п.).
 * Теперь информация о турнире выводится в отдельном контейнере (tournamentInfoContainer),
 * а список участников (participantListContainer) остаётся независимым и не перезаписывается.
 */

function loadTournamentDetails(tournamentId) {
  console.log('Загрузка деталей турнира для ID:', tournamentId);
  fetch(`/api/tournaments/${tournamentId}`, {
      method: "GET",
      headers: {
          "Content-Type": "application/json"
      }
  })
  .then(response => {
      if (!response.ok) {
          throw new Error(`Ошибка при загрузке деталей турнира: ${response.status}`);
      }
      return response.json();
  })
  .then(data => {
      console.log('Детали турнира получены:', data);
      displayTournamentDetails(data);
  })
  .catch(error => {
      console.error("Ошибка при загрузке деталей турнира:", error);
      const infoContainer = document.getElementById('tournamentInfoContainer');
      if (infoContainer) {
          infoContainer.innerText = "Ошибка загрузки деталей турнира";
      }
  });
}

function displayTournamentDetails(tournament) {
  if (!tournament) {
      console.error("Данные турнира не определены");
      return;
  }
  
  // Получаем или создаём контейнер для информации о турнире (без списка участников)
  let infoContainer = document.getElementById("tournamentInfoContainer");
  if (!infoContainer) {
      infoContainer = document.createElement("div");
      infoContainer.id = "tournamentInfoContainer";
      // Добавляем контейнер в начало элемента tournamentDetails
      const details = document.getElementById("tournamentDetails");
      if (details) {
          details.insertBefore(infoContainer, details.firstChild);
      } else {
          document.body.appendChild(infoContainer);
      }
  }
  
  infoContainer.style.display = "block";
  
  // Добавляем ссылку "Назад к списку турниров", если её ещё нет
  let backLink = infoContainer.querySelector("#backToList");
  if (!backLink) {
      backLink = document.createElement("a");
      backLink.id = "backToList";
      backLink.href = "/admin";
      backLink.dataset.screen = "admin"; // SPA-роутер перехватит клик
      backLink.innerText = "Назад к списку турниров";
      backLink.style.display = "block";
      backLink.style.marginBottom = "10px";
      infoContainer.insertBefore(backLink, infoContainer.firstChild);
  }
  
  // Заголовок турнира
  let titleElement = infoContainer.querySelector("#tournamentTitle");
  if (!titleElement) {
      titleElement = document.createElement("h3");
      titleElement.id = "tournamentTitle";
      infoContainer.appendChild(titleElement);
  }
  titleElement.textContent = tournament.name ? tournament.name : "Название турнира отсутствует";
  
  // Описание турнира
  let descriptionElement = infoContainer.querySelector("#tournamentDescription");
  if (!descriptionElement) {
      descriptionElement = document.createElement("p");
      descriptionElement.id = "tournamentDescription";
      infoContainer.appendChild(descriptionElement);
  }
  descriptionElement.textContent = tournament.description ? tournament.description : "Описание отсутствует";
  
  // Другие данные можно добавить в infoContainer, не затрагивая participantListContainer
}
