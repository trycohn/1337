/**
 * 🔍 СОВРЕМЕННЫЙ HOOK ДЛЯ МАСШТАБИРОВАНИЯ v2.0
 * 
 * Поддерживает колесо мыши и touch жесты для масштабирования
 * Оптимизирован для производительности с requestAnimationFrame
 * 
 * @param {Object} options - опции для настройки поведения
 * @param {number} options.initialZoom - начальный масштаб
 * @param {number} options.minZoom - минимальный масштаб
 * @param {number} options.maxZoom - максимальный масштаб
 * @param {number} options.zoomStep - шаг масштабирования
 * @param {boolean} options.requireCtrl - требовать Ctrl/Cmd для масштабирования колесом
 * @param {Function} options.onZoomChange - колбэк при изменении масштаба
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const useZoom = ({
    initialZoom = 1,
    minZoom = 0.3,
    maxZoom = 3,
    zoomStep = 0.05,
    requireCtrl = true,
    onZoomChange = null
} = {}) => {
    // Состояние масштаба
    const [zoom, setZoom] = useState(initialZoom);
    
    // Рефы для отслеживания состояния
    const zoomStateRef = useRef({
        animationId: null,
        lastTouchDistance: 0,
        isZooming: false
    });
    
    const containerRef = useRef(null);
    
    // Вспомогательная функция для ограничения масштаба
    const clampZoom = useCallback((value) => {
        return Math.max(minZoom, Math.min(maxZoom, value));
    }, [minZoom, maxZoom]);
    
    // Обработчик колеса мыши
    const handleWheel = useCallback((e) => {
        // Проверяем требование Ctrl/Cmd
        if (requireCtrl && !e.ctrlKey && !e.metaKey) {
            return;
        }
        
        e.preventDefault();
        
        // Отменяем предыдущую анимацию
        if (zoomStateRef.current.animationId) {
            cancelAnimationFrame(zoomStateRef.current.animationId);
        }
        
        // Планируем обновление масштаба
        zoomStateRef.current.animationId = requestAnimationFrame(() => {
            const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
            const newZoom = clampZoom(zoom + delta);
            
            if (newZoom !== zoom) {
                setZoom(newZoom);
                
                if (onZoomChange) {
                    onZoomChange({ 
                        zoom: newZoom, 
                        delta, 
                        event: e 
                    });
                }
            }
        });
    }, [zoom, zoomStep, clampZoom, requireCtrl, onZoomChange]);
    
    // Вспомогательная функция для расчета расстояния между касаниями
    const getTouchDistance = useCallback((touches) => {
        if (touches.length < 2) return 0;
        
        const touch1 = touches[0];
        const touch2 = touches[1];
        
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        
        return Math.sqrt(dx * dx + dy * dy);
    }, []);
    
    // Обработчик начала touch жеста
    const handleTouchStart = useCallback((e) => {
        if (e.touches.length === 2) {
            zoomStateRef.current.isZooming = true;
            zoomStateRef.current.lastTouchDistance = getTouchDistance(e.touches);
            e.preventDefault();
        }
    }, [getTouchDistance]);
    
    // Обработчик touch жеста
    const handleTouchMove = useCallback((e) => {
        if (!zoomStateRef.current.isZooming || e.touches.length !== 2) {
            return;
        }
        
        e.preventDefault();
        
        // Отменяем предыдущую анимацию
        if (zoomStateRef.current.animationId) {
            cancelAnimationFrame(zoomStateRef.current.animationId);
        }
        
        // Планируем обновление масштаба
        zoomStateRef.current.animationId = requestAnimationFrame(() => {
            const currentDistance = getTouchDistance(e.touches);
            const distanceDelta = currentDistance - zoomStateRef.current.lastTouchDistance;
            
            if (Math.abs(distanceDelta) > 5) { // Порог для избежания дрожания
                const scaleFactor = currentDistance / zoomStateRef.current.lastTouchDistance;
                const newZoom = clampZoom(zoom * scaleFactor);
                
                if (newZoom !== zoom) {
                    setZoom(newZoom);
                    
                    if (onZoomChange) {
                        onZoomChange({ 
                            zoom: newZoom, 
                            delta: newZoom - zoom, 
                            event: e 
                        });
                    }
                }
                
                zoomStateRef.current.lastTouchDistance = currentDistance;
            }
        });
    }, [zoom, getTouchDistance, clampZoom, onZoomChange]);
    
    // Обработчик окончания touch жеста
    const handleTouchEnd = useCallback((e) => {
        if (e.touches.length < 2) {
            zoomStateRef.current.isZooming = false;
            zoomStateRef.current.lastTouchDistance = 0;
            
            // Отменяем анимацию при окончании жеста
            if (zoomStateRef.current.animationId) {
                cancelAnimationFrame(zoomStateRef.current.animationId);
            }
        }
    }, []);
    
    // Добавляем обработчики событий
    useEffect(() => {
        const container = containerRef.current;
        const animationId = zoomStateRef.current.animationId;
        
        if (!container) return;
        
        // Добавляем обработчики
        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
        
        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            
            // Отменяем анимацию при cleanup
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);
    
    // Методы для управления масштабом
    const zoomIn = useCallback(() => {
        const newZoom = clampZoom(zoom + zoomStep);
        setZoom(newZoom);
        
        if (onZoomChange) {
            onZoomChange({ zoom: newZoom, delta: zoomStep });
        }
    }, [zoom, zoomStep, clampZoom, onZoomChange]);
    
    const zoomOut = useCallback(() => {
        const newZoom = clampZoom(zoom - zoomStep);
        setZoom(newZoom);
        
        if (onZoomChange) {
            onZoomChange({ zoom: newZoom, delta: -zoomStep });
        }
    }, [zoom, zoomStep, clampZoom, onZoomChange]);
    
    const setZoomLevel = useCallback((newZoom) => {
        const clampedZoom = clampZoom(newZoom);
        setZoom(clampedZoom);
        
        if (onZoomChange) {
            onZoomChange({ zoom: clampedZoom, delta: clampedZoom - zoom });
        }
    }, [zoom, clampZoom, onZoomChange]);
    
    const resetZoom = useCallback(() => {
        setZoom(initialZoom);
        
        if (onZoomChange) {
            onZoomChange({ zoom: initialZoom, delta: initialZoom - zoom });
        }
    }, [initialZoom, zoom, onZoomChange]);
    
    // Объект для привязки к DOM элементу
    const zoomHandlers = {
        ref: containerRef,
        onWheel: handleWheel,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd
    };
    
    return {
        zoom,
        zoomIn,
        zoomOut,
        setZoom: setZoomLevel,
        resetZoom,
        canZoomIn: zoom < maxZoom,
        canZoomOut: zoom > minZoom,
        zoomPercentage: Math.round(zoom * 100),
        zoomHandlers,
        containerRef
    };
};

export default useZoom; 