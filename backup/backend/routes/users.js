const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.get('/me', authenticateToken, (req, res) => {
    const user = req.user;
    res.json({ id: user.id, username: user.username, role: user.role });
});

module.exports = router;