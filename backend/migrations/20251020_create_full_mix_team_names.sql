-- Full Mix: Таблица случайных названий команд
-- Используется для Full Mix SE/DE турниров с фиксированными командами

CREATE TABLE IF NOT EXISTS full_mix_team_names (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого выбора активных названий
CREATE INDEX IF NOT EXISTS idx_full_mix_team_names_active ON full_mix_team_names(active) WHERE active = TRUE;

-- Наполнение таблицы юмористическими русскими названиями команд
INSERT INTO full_mix_team_names (name, active) VALUES
    ('Папины Читеры', TRUE),
    ('Мамкины Киберспортсмены', TRUE),
    ('Соседский WiFi', TRUE),
    ('Рашил Б', TRUE),
    ('Факап Драйв', TRUE),
    ('Горячие Клавиши', TRUE),
    ('Левый Клик', TRUE),
    ('ЧСВ Максимум', TRUE),
    ('Пинг 5 мс', TRUE),
    ('144 Герца', TRUE),
    ('Не в Сети', TRUE),
    ('AFK Легенды', TRUE),
    ('Читы Не Палят', TRUE),
    ('Жопа Кактуса', TRUE),
    ('Пять Пальцев', TRUE),
    ('Безликие', TRUE),
    ('Кулхацкеры', TRUE),
    ('Деды с Молотками', TRUE),
    ('Анонимные Алкоголики', TRUE),
    ('Случайный Критик', TRUE),
    ('Бесплатный Сыр', TRUE),
    ('Админ Слил', TRUE),
    ('Кто Читает Тот', TRUE),
    ('Спонсор Показа', TRUE),
    ('Банхаммер Летит', TRUE),
    ('VAC Байпасс', TRUE),
    ('Рандом Тимейты', TRUE),
    ('Сквад Бустеров', TRUE),
    ('Читы за 300', TRUE),
    ('Русские Хакеры', TRUE),
    ('Крабы на Кнопках', TRUE),
    ('Пять Раков', TRUE),
    ('Профи Диванного Спорта', TRUE),
    ('Ультра Ласт', TRUE),
    ('Слепая Зона', TRUE),
    ('Эко Раунд', TRUE),
    ('Фулл Бай', TRUE),
    ('Флеш Провокация', TRUE),
    ('Смок Криэйтив', TRUE),
    ('Молотов Коктейль', TRUE),
    ('Граната Врыва', TRUE),
    ('Де_Фьюз', TRUE),
    ('Б_Раш', TRUE),
    ('Спектейтор Команда', TRUE),
    ('Хэдшот Машина', TRUE),
    ('Обойма Пустая', TRUE),
    ('АВП Онли', TRUE),
    ('Дигл Кампани', TRUE),
    ('Тек-9 Раш', TRUE),
    ('ПП Биохазард', TRUE),
    ('Скаут Прыгает', TRUE),
    ('Автоснайпер Шеймеры', TRUE),
    ('Ноускоперы', TRUE),
    ('Банихоп Мастера', TRUE),
    ('Страйф Боги', TRUE),
    ('Кросхеир на Голову', TRUE),
    ('Прострел Через Дым', TRUE),
    ('360 Ноускоп', TRUE),
    ('Тапхед Гений', TRUE),
    ('Спрей Контроль', TRUE),
    ('Прожим', TRUE),
    ('Тролли Подземелья', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Сообщение об установке
DO $$
BEGIN
    RAISE NOTICE '✅ Full Mix: таблица названий команд создана и наполнена';
END
$$;

