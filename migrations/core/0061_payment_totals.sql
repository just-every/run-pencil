-- PAY-002: revision-frozen Checkout preferences and signed provider totals.
-- Response erasure already deletes its payment row; archives include these columns.
ALTER TABLE response_payments ADD COLUMN checkout_settings_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE response_payments ADD COLUMN discount INTEGER CHECK(discount >= 0);
ALTER TABLE response_payments ADD COLUMN tax INTEGER CHECK(tax >= 0);
ALTER TABLE response_payments ADD COLUMN total INTEGER CHECK(total >= 0);
UPDATE response_payments SET discount = 0, tax = 0, total = provider_amount WHERE provider_amount IS NOT NULL;
