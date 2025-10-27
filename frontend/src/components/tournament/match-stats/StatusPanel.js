import React, { useEffect } from 'react';

export function StatusPanel({ completedAt, onRefresh }) {
  // Тихое автообновление каждые 5 секунд (без отображения таймера)
  useEffect(() => {
    if (!onRefresh) return;
    
    const interval = setInterval(() => {
      onRefresh();
    }, 5000); // 5 секунд
    
    return () => clearInterval(interval);
  }, [onRefresh]);

  return null; // Ничего не отображаем
}


