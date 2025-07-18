# 🎯 Современная система перетаскивания и масштабирования

## Обзор

Новая система перетаскивания заменяет старую реализацию с множественными рефами и прямым управлением DOM событиями на современный подход с использованием:

- **Pointer Events API** для лучшей совместимости с touch устройствами
- **RequestAnimationFrame** для плавной анимации
- **Custom Hooks** для переиспользования логики
- **Оптимизированный рендеринг** с CSS transforms

## Доступные hooks

### `useDrag`
Базовый hook для перетаскивания элементов.

```javascript
const { position, isDragging, setPosition, resetPosition, dragHandlers } = useDrag({
    initialPosition: { x: 0, y: 0 },
    excludeSelectors: ['.no-drag'],
    onDragStart: (data) => console.log('Drag started'),
    onDragMove: (data) => console.log('Dragging'),
    onDragEnd: (data) => console.log('Drag ended')
});
```

### `useZoom`
Hook для масштабирования с поддержкой колеса мыши и touch жестов.

```javascript
const { 
    zoom, 
    zoomIn, 
    zoomOut, 
    setZoom, 
    resetZoom, 
    canZoomIn, 
    canZoomOut,
    zoomHandlers 
} = useZoom({
    initialZoom: 1,
    minZoom: 0.3,
    maxZoom: 3,
    zoomStep: 0.1,
    requireCtrl: true
});
```

### `useDragAndZoom`
Комбинированный hook для перетаскивания и масштабирования.

```javascript
const {
    position,
    zoom,
    isDragging,
    zoomPercentage,
    setPosition,
    zoomIn,
    zoomOut,
    setZoom,
    resetAll,
    centerView,
    fitToScreen,
    canZoomIn,
    canZoomOut,
    handlers
} = useDragAndZoom({
    initialPosition: { x: 0, y: 0 },
    initialZoom: 0.6,
    minZoom: 0.3,
    maxZoom: 3,
    zoomStep: 0.05,
    requireCtrl: true,
    excludeSelectors: ['.no-drag']
});
```

## Использование

### Простое перетаскивание

```javascript
import { useDrag } from '../hooks';

function DraggableComponent() {
    const { dragHandlers } = useDrag();
    
    return (
        <div {...dragHandlers}>
            Перетаскиваемый элемент
        </div>
    );
}
```

### Перетаскивание с масштабированием

```javascript
import { useDragAndZoom } from '../hooks';

function InteractiveComponent() {
    const { handlers, zoomPercentage } = useDragAndZoom();
    
    return (
        <div {...handlers}>
            <div>Масштаб: {zoomPercentage}%</div>
            <div>Содержимое</div>
        </div>
    );
}
```

## Особенности

### Производительность
- Использует `requestAnimationFrame` для плавной анимации
- CSS transforms для оптимизированного рендеринга
- Отмена предыдущих анимаций для избежания накопления

### Совместимость
- Pointer Events API для touch устройств
- Fallback для старых браузеров
- Поддержка mouse, touch и pen событий

### Гибкость
- Исключение элементов из перетаскивания
- Настраиваемые колбэки для событий
- Контроль ограничений масштаба

## Миграция со старой системы

### Было:
```javascript
// Старый подход с множественными рефами
const containerRef = useRef(null);
const isDraggingRef = useRef(false);
const dragStartRef = useRef({ x: 0, y: 0 });
const [position, setPosition] = useState({ x: 0, y: 0 });
const [isDragging, setIsDragging] = useState(false);

// Множественные обработчики событий
const handleMouseDown = useCallback((e) => { /* ... */ }, []);
const handleMouseMove = useCallback((e) => { /* ... */ }, []);
const handleMouseUp = useCallback((e) => { /* ... */ }, []);
```

### Стало:
```javascript
// Современный подход с hook
const { handlers, isDragging, position } = useDragAndZoom();

// Просто применяем обработчики
<div {...handlers}>
    Контент
</div>
```

## Преимущества

1. **Меньше кода** - от 100+ строк до 1 строки
2. **Лучшая производительность** - оптимизированные анимации
3. **Совместимость** - работает на всех устройствах
4. **Переиспользование** - легко применить в других компонентах
5. **Типизация** - полная поддержка TypeScript (при необходимости)

## Версии

- **v1.0** - Базовая реализация с mouse events
- **v2.0** - Pointer Events API + touch support
- **v3.0** - Комбинированный hook с масштабированием
- **v4.0** - Оптимизация производительности и CSS transforms 