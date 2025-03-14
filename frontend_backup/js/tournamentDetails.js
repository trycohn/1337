// tournamentDetails.js

import { loadTournamentDetails, loadParticipants } from './tournamentService.js';

// Загрузка и отображение деталей турнира
export async function loadAndDisplayTournamentDetails(tournamentId) {
  if (!tournamentId) throw new Error('ID турнира не указан');
    try {
        const tournament = await loadTournamentDetails(tournamentId);
        displayTournamentDetails(tournament);
    } catch (error) {
        console.error('Ошибка при загрузке деталей турнира:', error);
        const infoContainer = document.getElementById('tournamentInfoContainer');
        if (infoContainer) {
            infoContainer.innerText = 'Ошибка загрузки деталей турнира';
        }
    }
}

// Загрузка и отображение списка участников
export async function loadAndDisplayParticipants(tournamentId) {
  if (!tournamentId) throw new Error('ID турнира не указан');
    try {
        const participants = await loadParticipants(tournamentId);
        displayParticipants(participants);
    } catch (error) {
        console.error('Ошибка при загрузке участников:', error);
        const container = document.getElementById('participantListContainer');
        if (container) {
            container.innerText = 'Ошибка загрузки участников';
        }
    }
}

// Отображение деталей турнира
function displayTournamentDetails(tournament) {
    let infoContainer = document.getElementById('tournamentInfoContainer');
    if (!infoContainer) {
        infoContainer = document.createElement('div');
        infoContainer.id = 'tournamentInfoContainer';
        const details = document.getElementById('tournamentDetails');
        if (details) {
            details.insertBefore(infoContainer, details.firstChild);
        } else {
            document.body.appendChild(infoContainer);
        }
    }
    infoContainer.innerHTML = '';

    const title = document.createElement('h3');
    title.textContent = tournament.name || 'Название турнира отсутствует';
    infoContainer.appendChild(title);

    const description = document.createElement('p');
    description.textContent = tournament.description || 'Описание отсутствует';
    infoContainer.appendChild(description);
}

// Отображение списка участников
function displayParticipants(participants) {
    let container = document.getElementById('participantListContainer');
    if (!container) {
        container = document.createElement('ul');
        container.id = 'participantListContainer';
        const details = document.getElementById('tournamentDetails');
        if (details) {
            details.appendChild(container);
        } else {
            document.body.appendChild(container);
        }
    }
    container.innerHTML = '';

    if (!Array.isArray(participants) || participants.length === 0) {
        container.innerText = 'Нет участников.';
        return;
    }

    participants.forEach(participant => {
        const li = document.createElement('li');
        li.textContent = participant.name;
        container.appendChild(li);
    });
}