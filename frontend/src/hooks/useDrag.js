/**
 * 🎯 СОВРЕМЕННЫЙ HOOK ДЛЯ ПЕРЕТАСКИВАНИЯ v2.0
 * 
 * Использует Pointer Events API для лучшей совместимости с touch устройствами
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
        pointerStartPosition: { x: 0, y: 0 },
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
    
    // Обработчик начала перетаскивания (поддержка pointer events)
    const handlePointerDown = useCallback((e) => {
        if (disabled) return;
        
        // Проверяем, что это левая кнопка мыши или touch
        if (e.button && e.button !== 0) return;
        
        // Проверяем исключения
        if (shouldExcludeElement(e.target)) return;
        
        // Устанавливаем начальные параметры
        dragStateRef.current = {
            isDragging: true,
            startPosition: { ...position },
            lastPosition: { ...position },
            pointerStartPosition: { x: e.clientX, y: e.clientY },
            animationId: null
        };
        
        setIsDragging(true);
        
        // Захватываем pointer для лучшей обработки
        if (e.target.setPointerCapture) {
            e.target.setPointerCapture(e.pointerId);
        }
        
        // Предотвращаем выделение текста
        e.preventDefault();
        
        // Колбэк начала перетаскивания
        if (onDragStart) {
            onDragStart({ position, event: e });
        }
    }, [disabled, position, shouldExcludeElement, onDragStart]);
    
    // Обработчик перемещения (оптимизирован с rAF)
    const handlePointerMove = useCallback((e) => {
        if (!dragStateRef.current.isDragging) return;
        
        // Отменяем предыдущую анимацию
        if (dragStateRef.current.animationId) {
            cancelAnimationFrame(dragStateRef.current.animationId);
        }
        
        // Планируем обновление на следующий кадр
        dragStateRef.current.animationId = requestAnimationFrame(() => {
            if (!dragStateRef.current.isDragging) return;
            
            const deltaX = e.clientX - dragStateRef.current.pointerStartPosition.x;
            const deltaY = e.clientY - dragStateRef.current.pointerStartPosition.y;
            
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
    }, [onDragMove]);
    
    // Обработчик окончания перетаскивания
    const handlePointerUp = useCallback((e) => {
        if (!dragStateRef.current.isDragging) return;
        
        // Отменяем анимацию если есть
        if (dragStateRef.current.animationId) {
            cancelAnimationFrame(dragStateRef.current.animationId);
        }
        
        // Сбрасываем состояние
        dragStateRef.current.isDragging = false;
        setIsDragging(false);
        
        // Освобождаем pointer capture
        if (e.target.releasePointerCapture) {
            e.target.releasePointerCapture(e.pointerId);
        }
        
        // Колбэк окончания перетаскивания
        if (onDragEnd) {
            onDragEnd({ 
                position: dragStateRef.current.lastPosition,
                event: e 
            });
        }
    }, [onDragEnd]);
    
    // Обработчик отмены (для touch устройств)
    const handlePointerCancel = useCallback((e) => {
        if (dragStateRef.current.isDragging) {
            handlePointerUp(e);
        }
    }, [handlePointerUp]);
    
    // Добавляем обработчики событий
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        // Используем pointer events для лучшей совместимости
        container.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('pointercancel', handlePointerCancel);
        
        // Отключаем стандартное поведение touch
        container.style.touchAction = 'none';
        container.style.userSelect = 'none';
        
        return () => {
            container.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerCancel);
            
            // Отменяем анимацию при cleanup
            if (dragStateRef.current.animationId) {
                cancelAnimationFrame(dragStateRef.current.animationId);
            }
        };
    }, [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]);
    
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
            willChange: isDragging ? 'transform' : 'auto'
        },
        onPointerDown: handlePointerDown
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