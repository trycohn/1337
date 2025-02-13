// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');  // [Строка 1]
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // [Строка 2]

// Middleware для проверки JWT-токена
function authMiddleware(req, res, next) { // [Строка 4]
  const authHeader = req.headers.authorization; // [Строка 5]
  if (!authHeader) {
    return res.status(401).json({ status: 'error', message: 'No token provided' });
  }
  // Ожидается формат "Bearer <token>"
  const token = authHeader.split(' ')[1]; // [Строка 9]
  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Invalid token format' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET); // [Строка 13]
    req.user = decoded; // сохраняем данные пользователя в req.user
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Token is not valid' });
  }
}

module.exports = authMiddleware; // [Строка 21]
