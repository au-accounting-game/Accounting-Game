-- One-time migration for an EXISTING database: allow the new game key
-- 'game3-4' (Effect of Transactions without Net Income, CC + RE).
-- schema.sql already includes it for fresh installs.
--
-- Run on the server:  sudo -u postgres psql -d leaderboard -f migrate_add_game3-4.sql
--
-- The CHECK constraints in schema.sql are unnamed, so Postgres named them
-- <table>_game_check. If DROP reports nothing was dropped, look up the real
-- name with:  \d public.game_analytics

BEGIN;

ALTER TABLE public.game_analytics DROP CONSTRAINT IF EXISTS game_analytics_game_check;
ALTER TABLE public.game_analytics ADD CONSTRAINT game_analytics_game_check
    CHECK (game IN ('game1', 'game2', 'game3-1', 'game3-2', 'game3-3', 'game3-4'));

ALTER TABLE scores DROP CONSTRAINT IF EXISTS scores_game_check;
ALTER TABLE scores ADD CONSTRAINT scores_game_check
    CHECK (game IN ('game1', 'game2', 'game3-1', 'game3-2', 'game3-3', 'game3-4'));

COMMIT;
