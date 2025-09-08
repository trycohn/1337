-- Full Mix: настройки и снапшоты (победитель по числу побед)

-- Таблица настроек Full Mix для турнира
CREATE TABLE IF NOT EXISTS tournament_full_mix_settings (
    tournament_id INTEGER PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,
    wins_to_win INTEGER NOT NULL DEFAULT 3 CHECK (wins_to_win >= 1),
    rating_mode VARCHAR(20) NOT NULL DEFAULT 'random', -- 'random' | 'rating'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_fullmix_settings_tournament ON tournament_full_mix_settings(tournament_id);

-- Триггер для обновления updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_tournament_full_mix_settings_updated_at'
          AND event_object_table = 'tournament_full_mix_settings'
    ) THEN
        CREATE TRIGGER update_tournament_full_mix_settings_updated_at
            BEFORE UPDATE ON tournament_full_mix_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Таблица снапшотов раундов Full Mix
CREATE TABLE IF NOT EXISTS full_mix_snapshots (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL CHECK (round_number >= 1),
    snapshot JSONB NOT NULL, -- { teams: [...], matches: [...], standings: [...] }
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fullmix_snapshots_t_round
    ON full_mix_snapshots(tournament_id, round_number);

-- Сообщения об установке
DO $$
BEGIN
    RAISE NOTICE '✅ Full Mix: таблицы настроек и снапшотов готовы';
END
$$;


