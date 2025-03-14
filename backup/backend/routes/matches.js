const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// ✅ Обновление результата матча
router.put('/:id/results', authMiddleware, async (req, res) => {
  const matchId = req.params.id;
  const { score1, score2 } = req.body;

  try {
    await pool.query(
      'UPDATE matches SET score1 = $1, score2 = $2 WHERE id = $3',
      [score1, score2, matchId]
    );
    res.json({ status: 'success', message: 'Результаты матча обновлены' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ✅ Удаление матча
router.delete('/:id', authMiddleware, async (req, res) => {
  const matchId = req.params.id;

  try {
    await pool.query('DELETE FROM matches WHERE id = $1', [matchId]);
    res.json({ status: 'success', message: 'Матч удалён' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ✅ Завершение матча
router.put('/:id/complete', authMiddleware, async (req, res) => {
    const matchId = req.params.id;
  
    try {
      // Проверяем, существует ли матч
      const matchResult = await pool.query('SELECT * FROM matches WHERE id = $1', [matchId]);
      if (matchResult.rows.length === 0) {
        return res.status(404).json({ status: 'error', message: 'Матч не найден' });
      }
  
      // Обновляем статус матча на 'completed'
      await pool.query(
        "UPDATE matches SET status = 'completed' WHERE id = $1 RETURNING *",
        [matchId]
      );
  
      res.json({ status: 'success', message: 'Матч завершён' });
    } catch (err) {
      console.error('Ошибка при завершении матча:', err);
      res.status(500).json({ status: 'error', message: err.message });
    }
  });
  

module.exports = router;
