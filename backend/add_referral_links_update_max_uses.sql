-- Обновление лимита использований реферальных ссылок до 32

-- Меняем значение по умолчанию
ALTER TABLE referral_links ALTER COLUMN max_uses SET DEFAULT 32;

-- Массово обновляем существующие ссылки, у которых лимит был меньше 32
UPDATE referral_links
SET max_uses = 32
WHERE max_uses < 32;

DO $$
BEGIN
    RAISE NOTICE '✅ Лимит использований реферальных ссылок увеличен до 32 (default и существующие записи)';
END $$;


