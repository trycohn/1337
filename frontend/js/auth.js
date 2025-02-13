/*
 * Файл: auth.js
 * Описание: Обработка авторизации пользователей. Содержит логику входа, сохранения JWT-токена,
 * обновления отображения блока авторизации и выхода из системы.
 */
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutButton = document.getElementById('logoutButton');
  
    // Проверяем, существует ли в localStorage JWT-токен
    const token = localStorage.getItem('jwtToken');
    if (token) {
      // Если токен есть, отобразим сообщение "Привет, [имя пользователя]!" и кнопку выхода
      const storedUsername = localStorage.getItem('username') || 'Пользователь';
      usernameDisplay.textContent = `Привет, ${storedUsername}!`;
      loginForm.style.display = 'none';
      userInfo.style.display = 'block';
    } else {
      loginForm.style.display = 'block';
      userInfo.style.display = 'none';
    }
  
    // Обработчик события отправки формы логина
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault(); // Предотвращаем перезагрузку страницы
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;
      try {
        const response = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
          const errorData = await response.json();
          // Если пользователь не найден, можно предложить зарегистрироваться
          if (errorData.message && errorData.message.includes('не найден')) {
            alert(errorData.message + ' Если вы еще не зарегистрированы, перейдите по ссылке регистрации.');
          } else {
            alert(errorData.message);
          }
          return;
        }
        const data = await response.json();
        // Сохраняем токен и имя пользователя в localStorage
        localStorage.setItem('jwtToken', data.token);
        localStorage.setItem('username', username);
        // Обновляем отображение: скрываем форму логина и показываем приветствие с кнопкой выхода
        usernameDisplay.textContent = `Привет, ${username}!`;
        loginForm.style.display = 'none';
        userInfo.style.display = 'block';
      } catch (error) {
        alert('Ошибка: ' + error.message);
      }
    });
  
    // Обработчик события выхода
    logoutButton.addEventListener('click', function() {
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('username');
      loginForm.style.display = 'block';
      userInfo.style.display = 'none';
    });
  });
  