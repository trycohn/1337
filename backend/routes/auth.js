const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const bcrypt = require('bcrypt');

// Пример маршрута для аутентификации (входа)
//router.post('/login', async (req, res) => {
//  const { email, password } = req.body;
 // try {
 //   const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
//  if (result.rows.length === 0) {
//      return res.status(401).json({ message: 'Неверный email или пароль' });
//    }
//    const user = result.rows[0];
//    const isValid = await bcrypt.compare(password, user.password_hash);
//    if (!isValid) {
//      return res.status(401).json({ message: 'Неверный email или пароль' });
//    }
//    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
//    res.json({ token });
//  } catch (err) {
//    res.status(500).json({ error: err.message });
//  }
//});

module.exports = router;