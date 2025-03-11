import React, { useState } from 'react';
import axios from 'axios';

const AddParticipant = ({ tournamentId, onParticipantAdded }) => {
    const [name, setName] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) {
            alert('Введите имя участника');
            return;
        }
        try {
            const token = localStorage.getItem('jwtToken');
            await axios.post(
                `/api/tournaments/${tournamentId}/participants`,
                { name },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            alert('Участник добавлен!');
            setName('');
            onParticipantAdded(); // Обновляем список участников
        } catch (error) {
            alert(`Ошибка: ${error.response?.data?.error || error.message}`);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h4>Добавить участника</h4>
            <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Имя участника"
                required
            />
            <button type="submit">Добавить</button>
        </form>
    );
};

export default AddParticipant;