async function loadTournaments() {
    try {
        const response = await fetch('http://localhost:3000/api/tournaments', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            throw new Error(`Ошибка загрузки турниров (статус: ${response.status})`);
        }
        const data = await response.json();
        displayTournaments(data);
    } catch (error) {
        console.error('Ошибка загрузки турниров:', error);
    }
}

function displayTournaments(tournaments) {
    // Проверяем, что tournaments — массив
    const tournamentArray = Array.isArray(tournaments) ? tournaments : [];
    console.log('Количество турниров:', tournamentArray.length);
    // Дальше твоя логика отображения, например:
    const list = document.getElementById('tournament-list');
    if (list) {
        list.innerHTML = tournamentArray.map(t => `<li>${t.name}</li>`).join('');
    }
}

document.addEventListener('DOMContentLoaded', loadTournaments);