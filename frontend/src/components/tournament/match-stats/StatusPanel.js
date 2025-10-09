import React, { useEffect } from 'react';

export function StatusPanel({ completedAt, onRefresh }) {
  // Тихое автообновление каждые 15 секунд (без отображения таймера)
  useEffect(() => {
    if (!onRefresh) return;
    
    const interval = setInterval(() => {
      onRefresh();
    }, 15000); // 15 секунд
    
    return () => clearInterval(interval);
  }, [onRefresh]);

  return null; // Ничего не отображаем
}


