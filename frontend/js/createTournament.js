document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('createTournamentForm');
    if (!createForm) return; // Если формы нет, ничего не делаем

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Считываем поля формы
        const name = document.getElementById('tournamentName').value.trim();
        const description = document.getElementById('tournamentDescription').value.trim();
        const game = document.getElementById('tournamentGame').value;
        const type = document.getElementById('tournamentType').value; // 🆕 Новый селектор типа участия

        try {
            // Отправляем запрос на создание турнира
            const response = await fetch('http://localhost:3000/api/tournaments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
                },
                body: JSON.stringify({
                    name,
                    description,
                    game,
                    type // Передаём тип турнира (solo / teams)
                })
            });

            if (!response.ok) {
                throw new Error('Ошибка при создании турнира');
            }

            alert('Турнир успешно создан!');
            // После создания перенаправляем на страницу "Мои турниры"
            window.location.href = 'tournamentAdmin.html';
        } catch (error) {
            alert(error.message);
        }
    });
});
