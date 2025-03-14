/**
 * tournamentView.js
 *
 * Этот файл отвечает за загрузку и отображение информации о турнире.
 * Функция loadTournamentInfo выполняет GET‑запрос к API для получения данных турнира по его ID.
 * Функция displayTournamentInfo обновляет DOM элемент(ы) для отображения полученных данных.
 */

// Функция для загрузки информации о турнире по его ID
function loadTournamentInfo(tournamentId) {
    fetch(`/api/tournaments/${tournamentId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Ошибка при загрузке турнира: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Данные турнира получены:", data);
        displayTournamentInfo(data);
    })
    .catch(error => {
        console.error("Ошибка загрузки турнира:", error);
        // Если контейнер для отображения информации существует, выводим сообщение об ошибке
        const infoContainer = document.getElementById("tournamentInfoContainer");
        if (infoContainer) {
            infoContainer.innerText = "Ошибка загрузки турнира";
        }
    });
}

// Функция для отображения информации о турнире в DOM
function displayTournamentInfo(tournament) {
    // Проверяем, что объект турнира определён и содержит поле name
    if (!tournament) {
        console.error("Данные турнира не определены");
        return;
    }
    if (!tournament.name) {
        console.error("Поле name отсутствует в данных турнира", tournament);
        return;
    }
    
    // Получаем элемент для отображения названия турнира
    const nameDisplay = document.getElementById('tournamentNameDisplay');
    if (nameDisplay) {
        nameDisplay.textContent = tournament.name; // Устанавливаем название турнира
    } else {
        console.error('Элемент tournamentNameDisplay не найден');
    }
    
    // Обновляем текст элемента с именем турнира
    tournamentNameElement.innerText = tournament.name;
}

// Автоматическая загрузка информации, если в URL присутствует параметр "id" или "tournamentId"
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tournamentId = urlParams.get("id") || urlParams.get("tournamentId");
    if (tournamentId) {
        loadTournamentInfo(tournamentId);
    }
});
