import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { LoaderProvider } from './context/LoaderContext';

// Глобальная функция для безопасного преобразования ID в число
window.safeParseInt = (id) => {
  if (id === undefined || id === null) return null;
  return typeof id === 'string' ? parseInt(id) : id;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LoaderProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </LoaderProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
