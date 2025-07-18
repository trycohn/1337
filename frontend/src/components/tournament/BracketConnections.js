/**
 * 🎨 SVG СОЕДИНЕНИЯ ДЛЯ ТУРНИРНЫХ СЕТОК
 * 
 * Компонент для отрисовки анимированных соединений между матчами
 * Поддерживает различные типы соединений и анимации
 */

import React, { useState, useMemo } from 'react';

/**
 * Создание SVG пути для соединения
 */
const createConnectionPath = (from, to, curved = true) => {
  if (!curved) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  // Контрольные точки для кривой Безье
  const cx1 = from.x + dx * 0.5;
  const cy1 = from.y;
  const cx2 = from.x + dx * 0.5;
  const cy2 = to.y;
  
  return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
};

/**
 * Компонент одного соединения
 */
const Connection = ({ connection, index, isHighlighted, onHover }) => {
  const path = createConnectionPath(connection.from, connection.to, connection.curved);
  
  // Определяем цвет на основе типа
  const getColor = () => {
    if (connection.type === 'winner') return '#00ff00';
    if (connection.type === 'loser') return '#ff6b6b';
    if (connection.type === 'third-place') return '#ffcc00';
    if (connection.type === 'to-losers') return '#ff6b6b';
    return '#ff0000'; // По умолчанию
  };
  
  // Определяем стиль линии
  const getStrokeDasharray = () => {
    if (connection.style === 'dashed' || connection.type === 'to-losers') {
      return '5 5';
    }
    return null;
  };
  
  const color = getColor();
  const opacity = isHighlighted ? 1 : 0.6;
  
  return (
    <g
      onMouseEnter={() => onHover(index, true)}
      onMouseLeave={() => onHover(index, false)}
      style={{ cursor: 'pointer' }}
    >
      {/* Фоновая линия для лучшей видимости */}
      <path
        d={path}
        fill="none"
        stroke="#000"
        strokeWidth={connection.width || 4}
        opacity={opacity * 0.3}
        strokeDasharray={getStrokeDasharray()}
      />
      
      {/* Основная линия */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={connection.width || 2}
        opacity={opacity}
        strokeDasharray={getStrokeDasharray()}
      >
        {/* Анимация для линий to-losers */}
        {connection.type === 'to-losers' && (
          <animate
            attributeName="stroke-opacity"
            values="0.6;1;0.6"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </path>
      
      {/* Стрелка на конце для to-losers соединений */}
      {connection.type === 'to-losers' && (
        <defs>
          <marker
            id={`arrow-${index}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity={opacity} />
          </marker>
        </defs>
      )}
      
      {/* Применяем стрелку к линии */}
      {connection.type === 'to-losers' && (
        <path
          d={path}
          fill="none"
          stroke="none"
          markerEnd={`url(#arrow-${index})`}
        />
      )}
    </g>
  );
};

/**
 * Основной компонент соединений
 */
const BracketConnections = ({ connections, dimensions, className = '' }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  
  // Сортируем соединения по типу для правильного z-index
  const sortedConnections = useMemo(() => {
    return [...connections].sort((a, b) => {
      const order = { 'loser': 0, 'to-losers': 1, 'third-place': 2, 'winner': 3 };
      return (order[a.type] || 0) - (order[b.type] || 0);
    });
  }, [connections]);
  
  const handleHover = (index, isHovered) => {
    setHoveredIndex(isHovered ? index : null);
  };
  
  return (
    <svg
      className={`bracket-connections ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: dimensions.width,
        height: dimensions.height,
        pointerEvents: 'none',
        zIndex: 1
      }}
    >
      {/* Рендерим тень для всех соединений */}
      <g className="connections-shadow">
        {sortedConnections.map((connection, index) => (
          <path
            key={`shadow-${index}`}
            d={createConnectionPath(connection.from, connection.to, connection.curved)}
            fill="none"
            stroke="#000"
            strokeWidth={(connection.width || 2) + 2}
            opacity={0.2}
            strokeDasharray={connection.style === 'dashed' || connection.type === 'to-losers' ? '5 5' : null}
          />
        ))}
      </g>
      
      {/* Рендерим основные соединения */}
      <g className="connections-main" style={{ pointerEvents: 'auto' }}>
        {sortedConnections.map((connection, index) => (
          <Connection
            key={index}
            connection={connection}
            index={index}
            isHighlighted={hoveredIndex === null || hoveredIndex === index}
            onHover={handleHover}
          />
        ))}
      </g>
    </svg>
  );
};

export default BracketConnections; 