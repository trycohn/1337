// js/tournaments.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Сначала определяем маршрут для "моих" турниров
router.get('/myTournaments', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT * FROM tournaments t
      WHERE t.created_by = $1
         OR EXISTS (
           SELECT 1 FROM tournament_admins ta
           WHERE ta.tournament_id = t.id AND ta.admin_id = $1
         )
      ORDER BY created_at DESC;
    `;
    const result = await pool.query(query, [userId]);
    res.json({ status: 'success', tournaments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Затем определяем маршрут для получения турнира по id
router.get('/:id', async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const result = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Tournament not found' });
    }
    res.json({ status: 'success', tournament: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});


// Функция для загрузки списка турниров с бэкенда
async function loadTournaments() {
    try {
      const response = await fetch('http://localhost:3000/api/tournaments');
      if (!response.ok) {
        throw new Error('Ошибка при загрузке турниров');
      }
      const data = await response.json();
      displayTournaments(data.tournaments);
    } catch (error) {
      console.error('Ошибка:', error);
      document.getElementById('tournamentsContainer').innerText = 'Не удалось загрузить турниры.';
    }
  }
  
  // Функция для отображения списка турниров в DOM
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
      // Создаем ссылку на страницу деталей турнира
      const link = document.createElement('a');
      link.href = `tournamentDetails.html?id=${t.id}`;
      link.textContent = `${t.name} [${t.game}] - статус: ${t.status}`;
      listItem.appendChild(link);
      list.appendChild(listItem);
    });
    container.appendChild(list);
  }
  
  // Запускаем загрузку турниров при загрузке страницы
  document.addEventListener('DOMContentLoaded', loadTournaments);
  