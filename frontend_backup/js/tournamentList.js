/**
 * tournamentList.js
 *
 * Этот файл отвечает за загрузку и отображение общего списка турниров ("Список турниров")
 * на странице.
 *
 * Теперь названия турниров выводятся как ссылки с data-screen="admin",
 * чтобы при клике переходить к странице управления турниром.
 */

function renderTournaments(tournaments) {
    const tournamentListElement = document.getElementById('tournamentsContainer');
    if (!tournamentListElement) {
        console.error("Элемент с id 'tournamentsContainer' не найден.");
        return;
    }
    tournamentListElement.innerHTML = ''; // Очищаем содержимое

    tournaments.forEach(tournament => {
        const li = document.createElement('li');
        // Создаем ссылку для управления турниром
        const link = document.createElement('a');
        link.href = `/admin?tournamentId=${tournament.id}`;
        link.textContent = tournament.name;
        // Добавляем data-атрибут для SPA-роутинга
        link.dataset.screen = "admin";
        
        li.appendChild(link);
        tournamentListElement.appendChild(li);
    });
}

async function loadTournaments() {
    try {
        const response = await fetch('/api/tournaments');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            const text = await response.text();
            throw new Error(`Expected JSON, but received: ${text.substring(0, 100)}...`);
        }

        const tournaments = await response.json();
        renderTournaments(tournaments);
    } catch (error) {
        console.error("Ошибка загрузки турниров:", error);
        const tournamentListElement = document.getElementById('tournamentsContainer');
        if (tournamentListElement) {
            tournamentListElement.innerHTML = '<li>Ошибка загрузки турниров. Попробуйте позже.</li>';
        }
    }
}

document.addEventListener("DOMContentLoaded", loadTournaments);
