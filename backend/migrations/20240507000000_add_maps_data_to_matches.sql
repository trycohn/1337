-- Добавление колонки maps_data в таблицу matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS maps_data JSONB;

-- Обновляем существующие записи, устанавливая maps_data = NULL
UPDATE matches SET maps_data = NULL WHERE maps_data IS NULL;

-- Комментарий к колонке
COMMENT ON COLUMN matches.maps_data IS 'Данные о сыгранных картах в формате JSON для CS2 и других игр'; 