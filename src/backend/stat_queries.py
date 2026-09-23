# stat queries for prof and admin views

# --- PROFESSOR LEVEL QUERIES (Filtered by Section) ---

# 1. Student-specific stats within a section
# Shows: Name, Username, Avg Score, Top Score, Bottom Score per Game
from multiprocessing import pool


SQL_PROF_STUDENT_STATS = """
SELECT
    p.first_name,
    p.last_name,
    p.username,
    g.game,
    AVG(g.score) as avg_score,
    MAX(g.score) as top_score,
    MIN(g.score) as bottom_score,
    COUNT(*) as rounds_played
FROM public.player_profiles p
JOIN public.game_analytics g ON p.username = g.username
WHERE p.section = %s
GROUP BY p.first_name, p.last_name, p.username, g.game
ORDER BY p.last_name ASC, g.game ASC;
"""

# 2. Section Averages per Game
SQL_PROF_SECTION_AVERAGES = """
SELECT 
    g.game, 
    AVG(g.score) as section_avg_score
FROM public.player_profiles p
JOIN public.game_analytics g ON p.username = g.username
WHERE p.section = %s
GROUP BY g.game;
"""

# 3. Top Score per Game in Section (and who got it)
SQL_PROF_SECTION_TOP_SCORES = """
SELECT DISTINCT ON (g.game)
    g.game,
    g.score as top_score,
    p.first_name,
    p.last_name,
    p.username
FROM public.game_analytics g
JOIN public.player_profiles p ON g.username = p.username
WHERE p.section = %s
ORDER BY g.game, g.score DESC;
"""

# 4. Total Time Spent in Game per Student (Across all games)
SQL_PROF_STUDENT_TIME = """
SELECT 
    p.first_name, 
    p.last_name, 
    p.username, 
    g.game,
    SUM(g.time_played) as total_time_seconds
FROM public.player_profiles p
JOIN public.game_analytics g ON p.username = g.username
WHERE p.section = %s
GROUP BY p.first_name, p.last_name, p.username, g.game;
"""

# --- ADMIN LEVEL QUERIES (Global) ---

# 5. Global Top Score per Game (Includes Section)
SQL_ADMIN_GLOBAL_TOP_SCORES = """
SELECT DISTINCT ON (g.game)
    g.game,
    g.score as top_score,
    p.first_name,
    p.last_name,
    p.username,
    p.section
FROM public.game_analytics g
JOIN public.player_profiles p ON g.username = p.username
ORDER BY g.game, g.score DESC;
"""