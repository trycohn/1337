const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');

// Получить конфиг анкеты турнира
router.get('/:id/application-form', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT application_form_config FROM tournaments WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Tournament not found' });
    const config = result.rows[0].application_form_config || {};
    return res.json({ success: true, config });
  } catch (e) {
    console.error('GET application-form error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Отправить заявку (анкета) на участие
router.post('/:id/applications', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const payload = req.body || {};

    const tRes = await db.query('SELECT application_form_config FROM tournaments WHERE id = $1', [id]);
    if (!tRes.rows.length) return res.status(404).json({ error: 'Tournament not found' });
    const cfg = tRes.rows[0].application_form_config || {};
    if (!cfg.enabled) return res.status(400).json({ error: 'Application form is not required' });

    const fields = Array.isArray(cfg.fields) ? cfg.fields : [];

    // Валидация обязательных полей
    for (const f of fields) {
      if (f.required) {
        if (payload[f.key] === undefined || payload[f.key] === null || String(payload[f.key]).trim() === '') {
          return res.status(400).json({ error: `Поле ${f.key} обязательно` });
        }
      }
    }

    // Проверка возраста
    if (cfg.min_age && parseInt(cfg.min_age, 10) > 0) {
      const dob = payload.date_of_birth;
      if (!dob) return res.status(400).json({ error: 'Требуется дата рождения' });
      const birth = new Date(dob);
      if (isNaN(birth.getTime())) return res.status(400).json({ error: 'Некорректная дата рождения' });
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      if (age < parseInt(cfg.min_age, 10)) return res.status(400).json({ error: `Возрастное ограничение: ${cfg.min_age}+` });
    }

    // Upsert заявку
    const upsert = await db.query(
      `INSERT INTO tournament_applications (tournament_id, user_id, data, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (tournament_id, user_id) DO UPDATE SET data = EXCLUDED.data, status = 'pending', updated_at = NOW()
       RETURNING id, status`,
      [id, userId, payload]
    );

    return res.json({ success: true, application: upsert.rows[0] });
  } catch (e) {
    console.error('POST application error', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


