/**
 * 🎯 КОМБИНИРОВАННЫЙ HOOK ДЛЯ ПЕРЕТАСКИВАНИЯ И МАСШТАБИРОВАНИЯ v2.1
 * 
 * Объединяет функции перетаскивания и масштабирования в один hook
 * Оптимизирован для работы с внутренним элементом .bracket-renderer
 * Контейнер остается неподвижным, перетаскивается только содержимое
 * 
 * @param {Object} options - конфигурация hook
 * @param {Object} options.initialPosition - начальная позиция {x, y}
 * @param {number} options.initialZoom - начальный масштаб (по умолчанию 0.6)
 * @param {number} options.minZoom - минимальный масштаб 
 * @param {number} options.maxZoom - максимальный масштаб
 * @param {number} options.zoomStep - шаг масштабирования
 * @param {boolean} options.requireCtrl - требовать Ctrl для масштабирования колесом
 * @param {Array} options.excludeSelectors - CSS селекторы исключаемых элементов
 * @param {Function} options.onDragStart - колбэк начала перетаскивания
 * @param {Function} options.onDragMove - колбэк перемещения
 * @param {Function} options.onDragEnd - колбэк окончания перетаскивания
 * @param {Function} options.onZoomChange - колбэк изменения масштаба
 */

import { useRef, useCallback, useMemo } from 'react';
import useDrag from './useDrag';
import useZoom from './useZoom';

const useDragAndZoom = ({
    initialPosition = { x: 0, y: 0 },
    initialZoom = 0.6,
    minZoom = 0.3,
    maxZoom = 3,
    zoomStep = 0.05,
    requireCtrl = true,
    excludeSelectors = [
        '.bracket-navigation-panel',
        '.bracket-nav-icon-button',
        '.bracket-match-card',
        '.bracket-edit-match-btn'
    ],
    onDragStart = null,
    onDragMove = null,
    onDragEnd = null,
    onZoomChange = null,
    enableShiftWheelPan = true
} = {}) => {
    // Единый контейнер для обоих функций
    const containerRef = useRef(null);
    
    // Используем hook для перетаскивания
    const {
        position,
        isDragging,
        setPosition,
        resetPosition: resetDragPosition,
        dragHandlers
    } = useDrag({
        initialPosition,
        onDragStart,
        onDragMove,
        onDragEnd,
        excludeSelectors
    });
    
    // Используем hook для масштабирования
    const {
        zoom,
        zoomPercentage,
        setZoom,
        zoomIn,
        zoomOut,
        resetZoom: resetZoomLevel,
        canZoomIn,
        canZoomOut,
        zoomHandlers
    } = useZoom({
        initialZoom,
        minZoom,
        maxZoom,
        zoomStep,
        requireCtrl,
        onZoomChange
    });
    
    // Комбинированные функции управления
    const resetAll = useCallback(() => {
        resetDragPosition();
        resetZoomLevel();
    }, [resetDragPosition, resetZoomLevel]);
    
    const centerView = useCallback(() => {
        setPosition({ x: 0, y: 0 });
    }, [setPosition]);
    
    const fitToScreen = useCallback(() => {
        setPosition({ x: 0, y: 0 });
        setZoom(initialZoom);
    }, [setPosition, setZoom, initialZoom]);
    
    // Комбинированные обработчики для DOM элемента
    const combinedHandlers = useMemo(() => {
        const handleWheel = (e) => {
            try {
                if (enableShiftWheelPan && e.shiftKey && !e.ctrlKey) {
                    // Горизонтальный скролл: сдвигаем содержимое по оси X
                    e.preventDefault();
                    const primaryDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                    setPosition((prev) => ({ x: prev.x - primaryDelta, y: prev.y }));
                    return;
                }
                if (typeof zoomHandlers.onWheel === 'function') zoomHandlers.onWheel(e);
            } catch (_) {}
        };

        return {
            ref: containerRef,
            style: {
                ...dragHandlers.style,
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'top left'
            },
            // Объединяем обработчики drag и zoom
            onMouseDown: dragHandlers.onMouseDown,
            onWheel: handleWheel,
            onTouchStart: zoomHandlers.onTouchStart,
            onTouchMove: zoomHandlers.onTouchMove,
            onTouchEnd: zoomHandlers.onTouchEnd
        };
    }, [dragHandlers, zoomHandlers, position, zoom, enableShiftWheelPan, setPosition]);
    
    // Утилиты для работы с координатами
    const getTransformedCoordinates = useCallback((clientX, clientY) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { x: clientX, y: clientY };
        
        const x = (clientX - rect.left - position.x) / zoom;
        const y = (clientY - rect.top - position.y) / zoom;
        
        return { x, y };
    }, [position, zoom]);
    
    const getScreenCoordinates = useCallback((transformedX, transformedY) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return { x: transformedX, y: transformedY };
        
        const x = transformedX * zoom + position.x + rect.left;
        const y = transformedY * zoom + position.y + rect.top;
        
        return { x, y };
    }, [position, zoom]);
    
    return {
        // Состояние
        position,
        zoom,
        isDragging,
        zoomPercentage,
        
        // Методы управления позицией
        setPosition,
        resetPosition: resetDragPosition,
        centerView,
        
        // Методы управления масштабом
        zoomIn,
        zoomOut,
        setZoom,
        resetZoom: resetZoomLevel,
        canZoomIn,
        canZoomOut,
        
        // Комбинированные методы
        resetAll,
        fitToScreen,
        
        // Утилиты координат
        getTransformedCoordinates,
        getScreenCoordinates,
        
        // Обработчики для DOM
        handlers: combinedHandlers,
        containerRef
    };
};

export default useDragAndZoom; 