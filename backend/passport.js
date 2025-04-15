const passport = require('passport');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const faceitStrategy = require('@amber/passport-faceit');

// Настройка стратегии FACEIT
passport.use(new faceitStrategy({
    authorizationURL: 'https://accounts.faceit.com',
    tokenURL: 'https://api.faceit.com/auth/v1/oauth/token',
    callbackURL: process.env.FACEIT_REDIRECT_URI,
    clientID: process.env.FACEIT_CLIENT_ID,
    clientSecret: process.env.FACEIT_CLIENT_SECRET,
    scope: 'openid, email, profile',
    scopeSeparator: ',',
    customHeaders: {
      "Authorization": `Basic ${Buffer.from(
        process.env.FACEIT_CLIENT_ID + ":" + process.env.FACEIT_CLIENT_SECRET
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  },
  async (accessToken, refreshToken, params, profile, done) => {
    try {
      // Декодируем id_token для получения информации о пользователе
      const userData = jwt.decode(params.id_token);
      
      // Проверяем, существует ли пользователь с таким FACEIT ID
      const result = await pool.query('SELECT * FROM users WHERE faceit_id = $1', [userData.sub]);
      
      if (result.rows.length > 0) {
        // Пользователь уже существует, возвращаем его
        return done(null, result.rows[0]);
      } else {
        // Пользователь не существует, возвращаем данные для создания нового пользователя
        return done(null, {
          faceit_id: userData.sub,
          email: userData.email,
          username: userData.nickname || `faceit_${userData.sub.substring(0, 8)}`,
          is_new: true
        });
      }
    } catch (error) {
      console.error('Ошибка в FACEIT стратегии:', error);
      return done(error);
    }
  }
));

// Сериализация пользователя для сессии
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Десериализация пользователя из сессии
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      done(null, false);
    }
  } catch (error) {
    done(error);
  }
});

module.exports = passport; 