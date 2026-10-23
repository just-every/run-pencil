-- Coarse session-start class travels with the response; earlier responses stay unknown.
ALTER TABLE responses ADD COLUMN device_class TEXT
  CHECK(device_class IS NULL OR device_class IN ('mobile', 'tablet', 'desktop'));
