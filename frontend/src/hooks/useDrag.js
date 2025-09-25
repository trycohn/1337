/**
 * 🎯 СОВРЕМЕННЫЙ HOOK ДЛЯ ПЕРЕТАСКИВАНИЯ v2.1
 * 
 * Использует классические mouse events для максимальной совместимости
 * Оптимизирован для производительности с requestAnimationFrame
 * 
 * @param {Object} options - опции для настройки поведения
 * @param {Object} options.initialPosition - начальная позиция {x, y}
 * @param {Function} options.onDragStart - колбэк при начале перетаскивания
 * @param {Function} options.onDragMove - колбэк при перетаскивании
 * @param {Function} options.onDragEnd - колбэк при окончании перетаскивания
 * @param {boolean} options.disabled - отключить перетаскивание
 * @param {Array} options.excludeSelectors - CSS селекторы для исключения из перетаскивания
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const useDrag = ({
    initialPosition = { x: 0, y: 0 },
    onDragStart = null,
    onDragMove = null,
    onDragEnd = null,
    disabled = false,
    excludeSelectors = []
} = {}) => {
    // Состояние позиции и перетаскивания
    const [position, setPosition] = useState(initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    
    // Рефы для отслеживания состояния
    const dragStateRef = useRef({
        isDragging: false,
        startPosition: { x: 0, y: 0 },
        lastPosition: { x: 0, y: 0 },
        mouseStartPosition: { x: 0, y: 0 },
        animationId: null
    });
    
    const containerRef = useRef(null);
    
    // Проверка, должен ли элемент быть исключен из перетаскивания
    const shouldExcludeElement = useCallback((element) => {
        if (!excludeSelectors.length) return false;
        
        for (const selector of excludeSelectors) {
            if (element.matches?.(selector) || element.closest?.(selector)) {
                return true;
            }
        }
        return false;
    }, [excludeSelectors]);
    
    // Обработчик начала перетаскивания
    const handleMouseDown = useCallback((e) => {
        if (disabled) return;
        
        // Проверяем, что это левая кнопка мыши
        if (e.button !== 0) return;
        
        // Проверяем исключения
        if (shouldExcludeElement(e.target)) return;
        
        // Устанавливаем начальные параметры
        dragStateRef.current = {
            isDragging: true,
            startPosition: { ...position },
            lastPosition: { ...position },
            mouseStartPosition: { x: e.clientX, y: e.clientY },
            animationId: null
        };
        
        setIsDragging(true);
        
        // Не блокируем стандартный скролл/поведение — только убираем выделение текста через CSS
        
        // Добавляем обработчики к документу
        const mouseMove = (e) => {
            if (!dragStateRef.current.isDragging) return;
            // Не блокируем скролл страницы при перемещении курсора
            
            // Отменяем предыдущую анимацию
            if (dragStateRef.current.animationId) {
                cancelAnimationFrame(dragStateRef.current.animationId);
            }
            
            // Планируем обновление на следующий кадр
            dragStateRef.current.animationId = requestAnimationFrame(() => {
                if (!dragStateRef.current.isDragging) return;
                
                const deltaX = e.clientX - dragStateRef.current.mouseStartPosition.x;
                const deltaY = e.clientY - dragStateRef.current.mouseStartPosition.y;
                
                const newPosition = {
                    x: dragStateRef.current.startPosition.x + deltaX,
                    y: dragStateRef.current.startPosition.y + deltaY
                };
                
                setPosition(newPosition);
                dragStateRef.current.lastPosition = newPosition;
                
                // Колбэк перемещения
                if (onDragMove) {
                    onDragMove({ 
                        position: newPosition,
                        delta: { x: deltaX, y: deltaY },
                        event: e 
                    });
                }
            });
        };
        
        const mouseUp = (e) => {
            if (!dragStateRef.current.isDragging) return;
            
            // Отменяем анимацию если есть
            if (dragStateRef.current.animationId) {
                cancelAnimationFrame(dragStateRef.current.animationId);
            }
            
            // Сбрасываем состояние
            dragStateRef.current.isDragging = false;
            setIsDragging(false);
            
            // Удаляем обработчики с документа
            document.removeEventListener('mousemove', mouseMove);
            document.removeEventListener('mouseup', mouseUp);
            
            // Колбэк окончания перетаскивания
            if (onDragEnd) {
                onDragEnd({ 
                    position: dragStateRef.current.lastPosition,
                    event: e 
                });
            }
        };
        
        document.addEventListener('mousemove', mouseMove, { passive: true });
        document.addEventListener('mouseup', mouseUp, { passive: true });
        
        // Колбэк начала перетаскивания
        if (onDragStart) {
            onDragStart({ position, event: e });
        }
    }, [disabled, position, shouldExcludeElement, onDragStart, onDragMove, onDragEnd]);
    
    // Удаляем старые обработчики
    // const handleMouseMove = useCallback((e) => {...}, [onDragMove]);
    // const handleMouseUp = useCallback((e) => {...}, [handleMouseMove, onDragEnd]);
    
    // Добавляем обработчики событий
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        // Добавляем обработчик mousedown к контейнеру
        container.addEventListener('mousedown', handleMouseDown, { passive: false });
        
        // Отключаем стандартное поведение
        container.style.userSelect = 'none';
        container.style.webkitUserSelect = 'none';
        container.style.msUserSelect = 'none';
        container.style.mozUserSelect = 'none';
        
        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            
            // Отменяем анимацию при cleanup
            if (dragStateRef.current.animationId) {
                cancelAnimationFrame(dragStateRef.current.animationId);
            }
        };
    }, [handleMouseDown]);
    
    // Методы для управления позицией
    const setDragPosition = useCallback((newPosition) => {
        setPosition(newPosition);
        dragStateRef.current.lastPosition = newPosition;
    }, []);
    
    const resetPosition = useCallback(() => {
        setDragPosition(initialPosition);
    }, [initialPosition, setDragPosition]);
    
    // Объект для привязки к DOM элементу
    const dragHandlers = {
        ref: containerRef,
        style: {
            cursor: isDragging ? 'grabbing' : 'grab',
            transform: `translate(${position.x}px, ${position.y}px)`,
            willChange: isDragging ? 'transform' : 'auto',
            userSelect: 'none',
            webkitUserSelect: 'none',
            msUserSelect: 'none',
            mozUserSelect: 'none'
        },
        onMouseDown: handleMouseDown
    };
    
    return {
        position,
        isDragging,
        setPosition: setDragPosition,
        resetPosition,
        dragHandlers,
        containerRef
    };
};

export default useDrag; 