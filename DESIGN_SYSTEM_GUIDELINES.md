# 🎨 Дизайн-система 1337 Community

## Цветовая палитра

### Основные цвета
- **Основной фон**: `#000000` (черный)
- **Вторичный фон**: `#111111` (темно-серый)
- **Элементы интерфейса**: `#1a1a1a`
- **Границы**: `#333333`
- **Hover состояния**: `#2a2a2a`, `#444444`, `#555555`

### Текст
- **Основной текст**: `#ffffff` (белый)
- **Вторичный текст**: `#888888`, `#666666`
- **Placeholder текст**: `#888888`

### Акценты
- **Успех**: `#4caf50` (зеленый)
- **Ошибка**: `#ff6b6b` (красный)
- **Предупреждение**: `#ffcc66` (желтый)

## Типографика

### Шрифты
- **Основной шрифт**: системный шрифт
- **Вес шрифта**: `300` (light) для основного текста
- **Заголовки**: `text-transform: uppercase`, `letter-spacing: 0.5px-1px`

### Размеры
- **H1**: `28px`, `letter-spacing: 1px`
- **H2**: `24px`, `letter-spacing: 0.8px`
- **H3**: `20px`, `letter-spacing: 0.5px`
- **Основной текст**: `14px-16px`
- **Мелкий текст**: `12px-13px`

## Компоненты

### Кнопки
```css
.button {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #ffffff;
    border-radius: 0;
    padding: 8px 16px;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.2s ease;
    cursor: pointer;
}

.button:hover {
    background-color: #000000;
    color: #ffffff;
    transform: translateY(-1px);
}
```

### Поля ввода
```css
.input {
    background-color: #1a1a1a;
    color: #ffffff;
    border: 1px solid #333333;
    border-radius: 0;
    padding: 8px 12px;
    transition: all 0.2s ease;
}

.input:focus {
    outline: none;
    border-color: #555555;
    background-color: #2a2a2a;
}

.input::placeholder {
    color: #888888;
}
```

### Карточки
```css
.card {
    background-color: #111111;
    border: 1px solid #333333;
    border-radius: 0;
    padding: 15px;
    transition: all 0.2s ease;
    color: #ffffff;
}

.card:hover {
    background-color: #1a1a1a;
    border-color: #555555;
    transform: translateY(-2px);
}
```

### Модальные окна
```css
.modal {
    background-color: rgba(0, 0, 0, 0.8);
}

.modal-content {
    background-color: #111111;
    color: #ffffff;
    border: 1px solid #333333;
    border-radius: 0;
}
```

## Анимации и переходы

### Стандартные переходы
- **Основной**: `transition: all 0.2s ease`
- **Hover эффекты**: `transform: translateY(-1px)` или `translateY(-2px)`
- **Opacity**: для появления/исчезновения элементов

### Принципы анимации
- Быстрые и плавные переходы
- Минимальные трансформации
- Консистентность во всех компонентах

## Сетка и отступы

### Отступы
- **Маленькие**: `5px`, `8px`, `10px`
- **Средние**: `15px`, `20px`
- **Большие**: `30px`, `40px`

### Границы
- **Стандартная граница**: `1px solid #333333`
- **Hover граница**: `1px solid #555555`
- **Активная граница**: `1px solid #ffffff`

## Состояния элементов

### Статусы турниров
```css
.status-active {
    background-color: #1a4d1a;
    color: #66ff66;
    border: 1px solid #2d7d2d;
}

.status-in-progress {
    background-color: #4d3d1a;
    color: #ffcc66;
    border: 1px solid #7d6d2d;
}

.status-completed {
    background-color: #4d1a1a;
    color: #ff6666;
    border: 1px solid #7d2d2d;
}
```

### Сообщения
```css
.success-message {
    background-color: #1a2a1a;
    color: #4caf50;
    border: 1px solid #2d4d2d;
}

.error-message {
    background-color: #2a1a1a;
    color: #ff6b6b;
    border: 1px solid #4d2d2d;
}
```

## Адаптивность

### Брейкпоинты
- **Мобильные**: `max-width: 480px`
- **Планшеты**: `max-width: 768px`
- **Десктоп**: `min-width: 769px`

### Принципы
- Mobile-first подход
- Гибкие сетки
- Адаптивная типографика

## Иконки и изображения

### Аватары
```css
.avatar {
    border-radius: 50%;
    border: 1px solid #333333;
    object-fit: cover;
}

.avatar:hover {
    border-color: #555555;
}
```

### Placeholder для аватаров
```css
.avatar-placeholder {
    background-color: #333333;
    color: #ffffff;
    font-weight: 300;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

## Принципы дизайна

### Минимализм
- Чистые линии
- Отсутствие скругленных углов (`border-radius: 0`)
- Минимальное количество цветов
- Фокус на контенте

### Контрастность
- Высокий контраст между текстом и фоном
- Четкие границы элементов
- Различимые состояния элементов

### Консистентность
- Единые отступы и размеры
- Одинаковые переходы и анимации
- Стандартизированные компоненты

## Примеры использования

### Страница турнира
```css
.tournament-page {
    background-color: #000000;
    color: #ffffff;
    min-height: 100vh;
}

.tournament-header {
    border-bottom: 1px solid #333333;
    padding-bottom: 10px;
    margin-bottom: 20px;
}

.tournament-title {
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 1px;
}
```

### Чат
```css
.chat-container {
    background-color: #111111;
    border: 1px solid #333333;
}

.message {
    background-color: #1a1a1a;
    border-bottom: 1px solid #333333;
    padding: 10px;
}

.message:hover {
    background-color: #2a2a2a;
}
```

## Контрольный список

При создании нового компонента проверьте:

- [ ] Используется черный фон (`#000000` или `#111111`)
- [ ] Белый текст (`#ffffff`)
- [ ] Границы серого цвета (`#333333`)
- [ ] Отсутствие скругленных углов
- [ ] Переходы `0.2s ease`
- [ ] Hover эффекты с `translateY`
- [ ] Uppercase текст для заголовков
- [ ] Letter-spacing для улучшения читаемости
- [ ] Адаптивность для мобильных устройств

## Инструменты разработки

### CSS переменные (рекомендуется)
```css
:root {
    --bg-primary: #000000;
    --bg-secondary: #111111;
    --bg-tertiary: #1a1a1a;
    --border-primary: #333333;
    --border-hover: #555555;
    --text-primary: #ffffff;
    --text-secondary: #888888;
    --accent-success: #4caf50;
    --accent-error: #ff6b6b;
    --transition: all 0.2s ease;
}
```

### Утилитарные классы
```css
.bg-primary { background-color: var(--bg-primary); }
.bg-secondary { background-color: var(--bg-secondary); }
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.border-primary { border: 1px solid var(--border-primary); }
.transition-default { transition: var(--transition); }
.uppercase { text-transform: uppercase; }
.letter-spacing { letter-spacing: 0.5px; }
```

---

**Версия**: 1.0  
**Дата обновления**: Декабрь 2024  
**Статус**: Активная 