-- Runs once, on an empty volume (`main` comes from POSTGRES_DB).
-- `test` is for integration and e2e: both truncate it, so `main` (dev) survives test runs.
CREATE DATABASE test;
