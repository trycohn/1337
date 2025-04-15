# Настройка FACEIT аутентификации с Passport.js

## Установка зависимостей

```bash
npm install @amber/passport-faceit express-session
```

## Настройка переменных окружения

Убедитесь, что в файле `.env` присутствуют следующие переменные:

```
FACEIT_CLIENT_ID=ваш_client_id
FACEIT_CLIENT_SECRET=ваш_client_secret
FACEIT_REDIRECT_URI=https://ваш-домен.com/api/users/faceit-callback
SESSION_SECRET=ваш_секретный_ключ_для_сессий
```

## Настройка Passport.js

1. Создайте файл `passport.js` с настройкой стратегии FACEIT:

```javascript
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
```

2. Обновите файл `server.js`, добавив поддержку сессий и Passport:

```javascript
const session = require('express-session');
const passport = require('./passport');

// Настройка сессий для Passport
app.use(session({
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
}));

// Инициализация Passport
app.use(passport.initialize());
app.use(passport.session());
```

3. Обновите маршруты для FACEIT в файле `routes/users.js`:

```javascript
// Маршрут для перенаправления пользователя на страницу авторизации Faceit
router.get('/link-faceit', authenticateToken, (req, res) => {
    // Сохраняем ID пользователя в сессии для последующего использования
    req.session.userId = req.user.id;
    
    // Перенаправляем на авторизацию через Passport
    passport.authenticate('faceit', {
        state: req.user.id
    })(req, res);
});

// Callback для Faceit после авторизации
router.get('/faceit-callback', 
    passport.authenticate('faceit', { 
        failureRedirect: 'https://1337community.com/profile?error=faceit_auth_failed',
        session: false
    }), 
    async (req, res) => {
        try {
            // Получаем ID пользователя из сессии
            const userId = req.session.userId;
            
            if (!userId) {
                console.error('Ошибка: ID пользователя отсутствует в сессии');
                return res.redirect('https://1337community.com/profile?error=no_user_id');
            }
            
            // Если это новый пользователь FACEIT, создаем его
            if (req.user.is_new) {
                // Проверяем, не существует ли уже пользователь с таким email
                const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [req.user.email]);
                
                if (emailCheck.rows.length > 0) {
                    // Если пользователь с таким email существует, обновляем его faceit_id
                    await pool.query(
                        'UPDATE users SET faceit_id = $1 WHERE id = $2',
                        [req.user.faceit_id, emailCheck.rows[0].id]
                    );
                    console.log('FACEit профиль успешно привязан к существующему пользователю', emailCheck.rows[0].id);
                } else {
                    // Создаем нового пользователя
                    const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
                    const result = await pool.query(
                        'INSERT INTO users (username, email, password_hash, faceit_id) VALUES ($1, $2, $3, $4) RETURNING id',
                        [req.user.username, req.user.email, hashedPassword, req.user.faceit_id]
                    );
                    console.log('Создан новый пользователь с FACEit профилем', result.rows[0].id);
                }
            } else {
                // Обновляем faceit_id для существующего пользователя
                await pool.query(
                    'UPDATE users SET faceit_id = $1 WHERE id = $2',
                    [req.user.faceit_id, userId]
                );
                console.log('FACEit профиль успешно привязан для пользователя', userId);
            }
            
            // Очищаем сессию
            req.session.destroy();
            
            // Перенаправляем на страницу профиля
            res.redirect('https://1337community.com/profile?faceit=success');
        } catch (err) {
            console.error('Ошибка привязки Faceit:', err);
            res.redirect(`https://1337community.com/profile?error=faceit_error&message=${encodeURIComponent(err.message)}`);
        }
    }
);
```

## Настройка на стороне FACEIT

1. Зарегистрируйте приложение на [FACEIT Developer Portal](https://developers.faceit.com/)
2. Укажите правильный Redirect URI: `https://ваш-домен.com/api/users/faceit-callback`
3. Получите Client ID и Client Secret и добавьте их в `.env` файл

## Тестирование

1. Запустите сервер: `npm start`
2. Перейдите на страницу профиля и нажмите кнопку "Привязать FACEIT"
3. Авторизуйтесь через FACEIT
4. После успешной авторизации вы будете перенаправлены обратно на страницу профиля с привязанным FACEIT аккаунтом 