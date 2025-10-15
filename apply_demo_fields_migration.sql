-- ============================================================================
-- МИГРАЦИЯ: Добавление полей для хранения демо-файлов
-- Дата: 10 октября 2025
-- Описание: Поля для хранения пути к .dem файлам, загруженным от MatchZy
-- ============================================================================

-- Добавляем поля для хранения информации о демках
ALTER TABLE matchzy_maps 
  ADD COLUMN IF NOT EXISTS demo_file_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS demo_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_size_bytes BIGINT;

-- Создаем индекс для быстрого поиска демок по матчу
CREATE INDEX IF NOT EXISTS idx_matchzy_maps_demo ON matchzy_maps(matchid, mapnumber) 
  WHERE demo_file_path IS NOT NULL;

-- Комментарии к полям
COMMENT ON COLUMN matchzy_maps.demo_file_path IS 'Путь к .dem файлу на сервере';
COMMENT ON COLUMN matchzy_maps.demo_uploaded_at IS 'Время загрузки демки от MatchZy';
COMMENT ON COLUMN matchzy_maps.demo_size_bytes IS 'Размер демо-файла в байтах';

