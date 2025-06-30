-- Добавление поля для типа рейтинга микс-турниров
-- Дата: 2025-01-25
-- Описание: Добавляет поле mix_rating_type для хранения настроек рейтинга микс турниров

ALTER TABLE tournaments ADD COLUMN mix_rating_type VARCHAR(20) DEFAULT 'faceit' CHECK (mix_rating_type IN ('faceit', 'premier', 'mixed'));

-- Добавляем комментарий для документации
COMMENT ON COLUMN tournaments.mix_rating_type IS 'Тип рейтинга для микс турниров: faceit, premier или mixed (без учета рейтинга)';

-- Обновляем существующие микс турниры (если есть)
UPDATE tournaments SET mix_rating_type = 'faceit' WHERE format = 'mix' AND mix_rating_type IS NULL; 