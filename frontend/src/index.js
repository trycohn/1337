import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { LoaderProvider } from './context/LoaderContext';

// 🛡️ КРИТИЧЕСКИ ВАЖНО: Защита от React Error #130 (undefined root element)
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ [React App] КРИТИЧЕСКАЯ ОШИБКА: Элемент #root не найден в DOM!');
  console.error('❌ [React App] Проверьте что в public/index.html существует <div id="root"></div>');
  
  // Создаем элемент root если его нет (экстренное восстановление)
  const emergencyRoot = document.createElement('div');
  emergencyRoot.id = 'root';
  emergencyRoot.innerHTML = '<h1 style="color: red; text-align: center; margin-top: 50px;">ОШИБКА: Элемент #root не найден</h1>';
  document.body.appendChild(emergencyRoot);
  
  throw new Error('Root element not found! Check that public/index.html contains <div id="root"></div>');
}

console.log('✅ [React App] Root element найден, инициализируем приложение...');

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <LoaderProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LoaderProvider>
    </React.StrictMode>
  );
  
  console.log('✅ [React App] Приложение успешно инициализировано');
} catch (error) {
  console.error('❌ [React App] КРИТИЧЕСКАЯ ОШИБКА при инициализации React:', error);
  console.error('❌ [React App] Stack trace:', error.stack);
  
  // Показываем ошибку пользователю
  rootElement.innerHTML = `
    <div style="color: red; text-align: center; margin: 50px; font-family: Arial, sans-serif;">
      <h1>Ошибка инициализации приложения</h1>
      <p>Произошла критическая ошибка при запуске React приложения.</p>
      <p>Пожалуйста, обновите страницу или обратитесь к администратору.</p>
      <details style="margin-top: 20px; text-align: left;">
        <summary>Техническая информация</summary>
        <pre style="background: #f5f5f5; padding: 10px; margin-top: 10px; overflow: auto;">
Error: ${error.message}

Stack trace:
${error.stack}
        </pre>
      </details>
    </div>
  `;
  
  throw error;
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
