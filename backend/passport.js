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
      console.log('Получены параметры от FACEIT:', params);
      
      if (!params.id_token) {
        console.error('Отсутствует id_token в параметрах FACEIT');
        return done(new Error('Отсутствует id_token в параметрах FACEIT'));
      }
      
      // Декодируем id_token для получения информации о пользователе
      const userData = jwt.decode(params.id_token);
      console.log('Декодированные данные пользователя FACEIT:', userData);
      
      if (!userData || !userData.sub) {
        console.error('Неверный формат id_token:', userData);
        return done(new Error('Неверный формат id_token'));
      }
      
      // Проверяем, существует ли пользователь с таким FACEIT ID
      const result = await pool.query('SELECT * FROM users WHERE faceit_id = $1', [userData.sub]);
      
      if (result.rows.length > 0) {
        // Пользователь уже существует, возвращаем его
        console.log('Найден существующий пользователь с FACEIT ID:', userData.sub);
        return done(null, result.rows[0]);
      } else {
        // Пользователь не существует, возвращаем данные для создания нового пользователя
        console.log('Создание нового пользователя с FACEIT ID:', userData.sub);
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
  console.log('Сериализация пользователя:', user.id);
  done(null, user.id);
});

// Десериализация пользователя из сессии
passport.deserializeUser(async (id, done) => {
  try {
    console.log('Десериализация пользователя:', id);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      done(null, result.rows[0]);
    } else {
      console.log('Пользователь не найден при десериализации:', id);
      done(null, false);
    }
  } catch (error) {
    console.error('Ошибка десериализации пользователя:', error);
    done(error);
  }
});

module.exports = passport; 