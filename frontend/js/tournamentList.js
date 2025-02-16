document.addEventListener('DOMContentLoaded', loadTournaments);

// ✅ Загрузка списка турниров
async function loadTournaments() {
    try {
        const response = await fetch('http://localhost:3000/api/tournaments');
        if (!response.ok) {
            throw new Error('Ошибка загрузки турниров');
        }

        const data = await response.json();
        displayTournaments(data.tournaments);
    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('tournamentsContainer').innerText = 'Не удалось загрузить турниры.';
    }
}

// ✅ Отображение списка турниров в DOM
function displayTournaments(tournaments) {
    const container = document.getElementById('tournamentsContainer');
    container.innerHTML = '';

    if (tournaments.length === 0) {
        container.innerText = 'Нет доступных турниров.';
        return;
    }

    const list = document.createElement('ul');
    tournaments.forEach(t => {
        const listItem = document.createElement('li');
        const link = document.createElement('a');
        link.href = `tournamentView.html?id=${t.id}`;
        link.textContent = `${t.name} [${t.game}] - статус: ${t.status}`;
        listItem.appendChild(link);
        list.appendChild(listItem);
    });

    container.appendChild(list);
}
