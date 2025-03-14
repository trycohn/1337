export async function generateBracket(tournamentId, withThirdPlace = false) {
    try {
        const token = localStorage.getItem('jwtToken');
        if (!token) {
            throw new Error('Вы не авторизованы. Пожалуйста, войдите в систему.');
        }

        const response = await fetch(`/api/tournaments/${tournamentId}/generateBracket`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ withThirdPlace }),
            cache: 'no-store'
        });

        if (!response.ok) {
            let errorMessage;
            switch (response.status) {
                case 401:
                    errorMessage = 'Неавторизованный доступ. Пожалуйста, войдите в систему.';
                    break;
                case 404:
                    errorMessage = 'Турнир не найден.';
                    break;
                case 500:
                    errorMessage = 'Ошибка на сервере. Попробуйте позже.';
                    break;
                default:
                    errorMessage = `Ошибка генерации сетки: ${response.status}`;
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('Ошибка при генерации сетки:', error);
        throw error;
    }
}