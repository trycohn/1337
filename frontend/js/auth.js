// frontend/js/auth.js

document.addEventListener('DOMContentLoaded', function() {
    // Находим все элементы
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const userInfo = document.getElementById('userInfo');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutButton = document.getElementById('logoutButton');

    const showRegisterFormButton = document.getElementById('showRegisterForm');
    const showLoginFormButton = document.getElementById('showLoginForm');

    // Проверяем, есть ли сохранённый токен
    const token = localStorage.getItem('jwtToken');
    const userId = localStorage.getItem('userId');

    if (token && userId) {
        showUserInfo();
    } else {
        showLoginForm();
    }

    // Переключение на форму регистрации
    if (showRegisterFormButton && showLoginFormButton) {
        showRegisterFormButton.addEventListener('click', function() {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        });
        // Переключение обратно на форму входа
        showLoginFormButton.addEventListener('click', function() {
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        });
    }

    // Обработка входа в систему
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Ошибка авторизации');
                }

                const data = await response.json();
                localStorage.setItem('jwtToken', data.token);
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('username', username);

                showUserInfo();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // Обработка регистрации
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;

            try {
                const response = await fetch('http://localhost:3000/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Ошибка регистрации');
                }

                const data = await response.json();
                localStorage.setItem('jwtToken', data.token);
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('username', username);
                localStorage.setItem('email', email);

                showUserInfo();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // Обработка выхода
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('email');
            showLoginForm();
        });
    }

    // Показываем блок с информацией о пользователе
    function showUserInfo() {
        if (!userInfo || !usernameDisplay || !loginForm || !registerForm) return;

        usernameDisplay.textContent = `Привет, ${localStorage.getItem('username')}!`;
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        userInfo.style.display = 'block';
    }

    // Показываем форму входа
    function showLoginForm() {
        if (!userInfo || !loginForm || !registerForm) return;
        
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        userInfo.style.display = 'none';
    }
});


