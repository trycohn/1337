import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Обновляем состояние, чтобы отобразить резервный UI
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Логируем ошибку для отладки
    console.error('Error caught by ErrorBoundary:', error, info.componentStack);
    // Здесь можно добавить отправку ошибки в аналитический сервис
  }

  render() {
    if (this.state.hasError) {
      // Отображаем резервный UI при возникновении ошибки
      return (
        <div style={{ color: 'red', textAlign: 'center' }}>
          <h1>Произошла ошибка при отображении сетки</h1>
          <p>{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;