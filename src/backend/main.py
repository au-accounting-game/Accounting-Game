# main.py
import os
from datetime import datetime
from typing import List, Literal, TypedDict, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Body, Query, Path, Request
from fastapi.responses import RedirectResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import psycopg2
from psycopg2.pool import SimpleConnectionPool
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import re
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.utils import OneLogin_Saml2_Utils

from stat_queries import *

# for downloading the excel files 
import io
import csv
from fastapi.responses import StreamingResponse

# reading override roles from excel file
import pandas as pd
from pandas import read_excel

import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("SAML")
logger.setLevel(logging.INFO)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_GAMES = {"game1", "game2", "game3-1", "game3-2", "game3-3"}
TOP_N = 100

GAME_ALIASES = {
    "game1": "game1",
    "game2": "game2",
    "gm3-level1": "game3-1",
    "gm3-level2": "game3-2",
    "gm3-level3": "game3-3"
}
 
@asynccontextmanager
async def lifespan(app: FastAPI):
    global pool
    # startup
    pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)
    yield
    # shutdown
    if pool:
        pool.closeall()
        pool = None

app = FastAPI(lifespan=lifespan, title="Arcade Leaderboard & Analytics API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"], # let us see login info on local and server
    
    allow_credentials=True,
    allow_methods=["*"],        # <-- allow all methods (GET, POST, etc.)
    allow_headers=["*"],        # <-- allow all headers
)

# Session middleware for storing parsed user info
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET"))


class LeaderboardRow(BaseModel):
    rank: int
    score: int
    username: str

# --- NEW SQL QUERIES FOR ANALYTICS TABLES ---

SQL_GET_LEADERBOARD = """
SELECT 
    RANK() OVER (ORDER BY score DESC, played_at ASC) AS rank,
    score, 
    UPPER(SUBSTRING(username, 1, 3)) AS username
FROM public.game_analytics
WHERE game = %s
ORDER BY score DESC, played_at ASC
LIMIT %s;
"""


SQL_UPSERT_USER = """
INSERT INTO public.player_profiles (username, first_name, last_name, section)
VALUES (%s, %s, %s, %s)
ON CONFLICT (username) 
DO UPDATE SET 
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.player_profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.player_profiles.last_name),
    section = COALESCE(NULLIF(EXCLUDED.section, ''), public.player_profiles.section);
"""

SQL_INSERT_SESSION = """
INSERT INTO public.game_analytics (game, username, score, time_played)
VALUES (%s, %s, %s, %s)
RETURNING id;
"""

SQL_GET_CURRENT_RANK = """
SELECT COUNT(*) + 1 
FROM public.game_analytics 
WHERE game = %s AND score > %s;
"""

SQL_PREVIEW = """
WITH BestScores AS (
    SELECT username, MAX(score) as max_score
    FROM public.game_analytics
    WHERE game = %s
    GROUP BY username
), stats AS (
  SELECT
    COUNT(*) FILTER (WHERE max_score > %s) AS cnt_gt,
    COUNT(*) FILTER (WHERE max_score = %s) AS cnt_eq,
    COUNT(*)                             AS rows_total
  FROM BestScores
)
SELECT
  1 + cnt_gt + cnt_eq AS preview_rank,
  (rows_total < %s) OR (1 + cnt_gt + cnt_eq) <= %s AS qualifies,
  rows_total AS current_rows
FROM stats;
"""


@app.get(
    "/leaderboard/{game}",
    response_model=List[LeaderboardRow],
    summary="Get leaderboard for a game",
    description="Returns rank, score, 3-letter username for the requested game based on all-time bests."
)
def get_leaderboard(
    game: str = Path(..., description="Game identifier (e.g., 'game1')"),
    limit: int = Query(TOP_N, ge=1, le=100, description="Number of rows to return (1–100)."),
    section: Optional[str] = Query(None, description="Optional section filter (e.g., '001')") # <-- NEW
    
):
    game = GAME_ALIASES.get(game.lower(), game.lower())

    if game not in ALLOWED_GAMES:
        raise HTTPException(status_code=404, detail="Unknown game")

    if pool is None:
        raise HTTPException(status_code=500, detail="DB not initialized")

    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            # --- NEW LOGIC START ---
            # --- FIX: Change g.game_id to g.game ---
            if section:
                sql = """
                    SELECT 
                    RANK() OVER (ORDER BY score DESC) as rank,
                        score,
                        p.username
                    FROM game_analytics g
                    JOIN player_profiles p ON g.username = p.username
                    WHERE g.game = %s AND p.section = %s
                    ORDER BY score DESC
                    LIMIT %s
                """
                
                cur.execute(sql, (game, section, limit))
            else:
                # Original Global Query (uses your predefined SQL_GET_LEADERBOARD)
                cur.execute(SQL_GET_LEADERBOARD, (game, limit))
            # --- NEW LOGIC END ---

            rows = cur.fetchall()
            
        return [{"rank": r, "score": s, "username": u.strip() if isinstance(u, str) else u} for (r, s, u) in rows]
    finally:
        pool.putconn(conn)


# --- UPDATED PAYLOAD MODELS ---
class SubmitPayload(BaseModel):
    game: str = Field(..., examples=["game1"])
    username: str = Field(..., examples=["sms0184"]) 
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    section: Optional[str] = None
    score: int = Field(..., ge=0, examples=[12345])
    time_played: int = Field(0, ge=0, examples=[120]) 

class SubmitResult(BaseModel):
    accepted: bool          
    rank: Optional[int]     
    score: int              
    username: str
    game: str

@app.post("/submit", response_model=SubmitResult, summary="Submit a score and update user profile")
def submit_score(payload: SubmitPayload = Body(...)):

    game = GAME_ALIASES.get(payload.game.lower(), payload.game.lower())

    if game not in ALLOWED_GAMES:
        raise HTTPException(status_code=400, detail="Unknown game")
    
    username = payload.username.lower()

    if pool is None:
        raise HTTPException(status_code=500, detail="DB not initialized")

    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # 1) Upsert User Profile
                cur.execute(SQL_UPSERT_USER, (
                    username, 
                    payload.first_name, 
                    payload.last_name, 
                    payload.section
                ))

                # 2) Insert Game Session (Ledger)
                cur.execute(SQL_INSERT_SESSION, (
                    game, 
                    username, 
                    payload.score, 
                    payload.time_played
                ))

                # 3) Fetch current rank for this score
                cur.execute(SQL_GET_CURRENT_RANK, (game, payload.score))
                rank_row = cur.fetchone()
                rank = rank_row[0] if rank_row else 1

                return SubmitResult(
                    accepted=True,
                    rank=int(rank),
                    score=payload.score,
                    username=username,
                    game=game,
                )
    finally:
        pool.putconn(conn)


class PreviewResponse(BaseModel):
    preview_rank: int
    qualifies: bool
    current_rows: int
    top_n: int
    game: str
    score: int

@app.get("/preview", response_model=PreviewResponse, summary="Preview rank for a score (no insert)")
def preview_rank(game: str, score: int, n: int = TOP_N):

    game = GAME_ALIASES.get(game.lower(), game.lower())

    if pool is None:
        raise HTTPException(status_code=500, detail="DB not initialized")
    if game not in ALLOWED_GAMES:
        raise

# SAML ---------------------------------------------------------------------------------------------------------------


SAML_PATH = os.getenv('SAML_PATH', os.path.join(os.path.dirname(__file__), 'saml'))

def prepare_fastapi_request(request: Request, body: dict = {}):
    return {
        'https': request.headers.get('x-forwarded-proto', 'http'),
        'http_host': request.headers.get('x-forwarded-host', request.headers.get('host')),
        'server_port': request.headers.get('x-forwarded-port', '443'),
        'script_name': request.url.path,
        'get_data': dict(request.query_params),
        'post_data': body
    }

# returns SP metadata XML, which IdP admins can use to configure the connection. No auth required since it's public info.
@app.get('/saml/metadata', tags=["SAML"])
async def saml_metadata(request: Request):
    req = prepare_fastapi_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=SAML_PATH)
    settings = auth.get_settings()
    metadata = settings.get_sp_metadata()
    errors = settings.validate_metadata(metadata)
    if errors:
        return Response(content=f"Metadata error: {', '.join(errors)}", status_code=500)
    return Response(content=metadata, media_type='text/xml')

# redirects to auburn login page
@app.get('/saml/login', tags=["SAML"])
async def saml_login(request: Request):
    req = prepare_fastapi_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=SAML_PATH)
    return RedirectResponse(auth.login())

# IdP posts SAML response here after login, we then validate it and extract user info
@app.post('/saml/acs', tags=["SAML"])
async def saml_acs(request: Request):
    form = await request.form()
    req = prepare_fastapi_request(request, dict(form))
    auth = OneLogin_Saml2_Auth(req, custom_base_path=SAML_PATH)
    auth.process_response()
    errors = auth.get_errors()
    if errors:
        return Response(
            content=f"SAML error: {', '.join(errors)} — {auth.get_last_error_reason()}",
            status_code=400
        )
    if not auth.is_authenticated():
        return Response(content="Not authenticated", status_code=403)
    # grab student info
    email = auth.get_nameid()
    userid = email.split('@')[0]

    attrs = auth.get_attributes()
    first_name = attrs.get("givenName", [""])[0]
    last_name = attrs.get("sn", [""])[0]

    # save userid for frontend as database key
    request.session['userid'] = userid

    # ===PARSING===
    # parse the memberOf attribute for section info + student/professor
    mo = attrs.get('memberOf', [])

    # ensure memberOf is populated
    if not mo:
        return Response(content="No memberOf attribute found", status_code=400)
    
    # role flags
    is_professor = False
    is_student = False
    sections = []

    # each group is a string like "CN=2024S_ACCT2110_001,OU=Groups,DC=auburn,DC=edu"
    for group in mo:

        # only look at common name
        cn = None

        for part in group.split(','):
            if part.strip().startswith('CN='):
                cn = part.split('=')[1].strip()
                break

        if not cn:
            continue

        # raise professor flag
        if cn == 'AU_Teaching':
            is_professor = True
            continue

        # raise student flag
        elif cn == 'AUA_Student_Gids':
            is_student = True

        # detect sections ACCT 2110 and ACCT 5110
        else:
            if re.match(r'^\d{4}[FS]_ACCT[25]110_\d{3}$', cn): # Ex: "2024S_ACCT2110_001"
                sections.append(cn)

    # null section if they don't belong
    if not sections:
        sections = None

    # a student can match more than one section group (e.g. cross-listed or
    # multiple terms) - pick the most recent term instead of concatenating
    # them together. Sort by (year, term) with Spring before Fall within the
    # same year, since plain string comparison ranks "S" above "F"
    # alphabetically, which is backwards (Spring precedes Fall each year).
    def term_sort_key(section_name):
        year = int(section_name[:4])
        term_rank = {"S": 0, "F": 1}.get(section_name[4], -1)
        return (year, term_rank)

    cs_sections = max(sections, key=term_sort_key) if sections else None

    # save role

    # handle role override 
    # edit in public/assets/role_override.xlsx
    # Column A: Admin Permissions | Column C: Professor Permissions | Column D: Allowed Professor Section Numbers
    df = read_excel('../../public/assets/role_override.xlsx', usecols=[0, 2, 3]) 

    # Check for Admin override
    if userid in df.iloc[:, 0].astype(str).tolist():
        request.session['role'] = 'admin'
    
    # Check for Professor override
    elif userid in df.iloc[:, 1].astype(str).tolist():
        request.session['role'] = 'professor'

        # Find row where Column C matches userid,
        # get the corresponding value from Column D
        sections_override = df.loc[
            df.iloc[:, 1].astype(str) == userid,
            df.columns[2]
        ].iloc[0]

        # Only override if it isn't empty
        if pd.notna(sections_override):
            cs_sections = sections_override.strip()
            logger.info(f"Professor '{userid}' has section override: {cs_sections}")

    elif is_professor and is_student:
        request.session['role'] = 'professor_student'
    elif is_professor:
        request.session['role'] = 'professor'
    elif is_student:
        request.session['role'] = 'student'
    else:
        request.session['role'] = 'unknown'
    
    # save sections
    request.session['sections'] = cs_sections

    #Log all saved information
    logger.info(f"User '{userid}' authenticated with role '{request.session['role']}' and saved sections: {cs_sections}")

    # UPSERT the user data
    if pool is None:
        raise HTTPException(status_code=500, detail="DB not initialized")

    conn = pool.getconn()
    try:
        conn.autocommit = True 
        
        with conn:
            with conn.cursor() as cur:
                cur.execute(SQL_UPSERT_USER, (
                    userid, 
                    first_name, 
                    last_name, 
                    cs_sections if cs_sections else None
                ))
        conn.commit()
        logger.info(f"Database entry created/updated for user '{userid}' with name '{first_name} {last_name}' and sections: {cs_sections}")

    except Exception as e:
        logger.error(f"Database error during SAML ACS processing for user '{userid}': {e}")
        return Response(content=f"Database error: {str(e)}", status_code=500)
    finally:
        pool.putconn(conn)

    return RedirectResponse('/', status_code=302)

# fetch userid and role for frontend
@app.get('/fetch-user')
async def fetch_user(request: Request):
    return {
        "userid": request.session.get('userid'),
        "role": request.session.get('role'),
        "sections": request.session.get('sections')
    }

# handles log out requests/responses
@app.get('/saml/sls', tags=["SAML"])
async def saml_sls(request: Request):
    req = prepare_fastapi_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=SAML_PATH)
    url = auth.process_slo()
    errors = auth.get_errors()
    if errors:
        return Response(content=f"SLO error: {', '.join(errors)}", status_code=400)
    return RedirectResponse(url or '/')

# initiates logout
@app.get('/saml/logout', tags=["SAML"])
async def saml_logout(request: Request):
    req = prepare_fastapi_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=SAML_PATH)
    return RedirectResponse(auth.logout())

# for testing without Auburn SSO — works locally and on the server
# --- Updated Fake Login that actually saves to DB ---
@app.post("/saml/fake-login", tags=["SAML"])
async def fake_login(payload: dict = Body(...)):
    username = payload.get("username", "guest").lower()
    first = payload.get("first_name")
    last = payload.get("last_name")
    section = payload.get("section")

    if pool is None:
        raise HTTPException(status_code=500, detail="DB not initialized")

    conn = pool.getconn()
    try:

        conn.autocommit = True 
        
        with conn:
            with conn.cursor() as cur:
                # Use the UPSERT query you already defined at the top of main.py
                cur.execute(SQL_UPSERT_USER, (
                    username, 
                    first, 
                    last, 
                    section
                ))
        conn.commit()
        
        print(f"DEBUG: Profile created/updated for {username} ({first} {last})")
        
        return {
            "status": "success",
            "username": username,
            "message": f"Login successful. Profile for {first} {last} updated."
        }
    except Exception as e:
        print(f"Database error in fake-login: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        pool.putconn(conn)


# --- ANALYTICS QUERIES ---

# prof view 
@app.get("/stats/section/{section_id}")
def get_section_report(section_id: str):
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            # 1. Individual Performance 
            # Ensure SQL_PROF_STUDENT_STATS selects: first_name, last_name, username, game, avg, max, min
            cur.execute(SQL_PROF_STUDENT_STATS, (section_id,))
            student_stats = cur.fetchall()

            # 2. Section Averages per Game
            cur.execute(SQL_PROF_SECTION_AVERAGES, (section_id,))
            averages = cur.fetchall()

            # 3. Total Time Spent
            cur.execute(SQL_PROF_STUDENT_TIME, (section_id,))
            time_spent = cur.fetchall()

            return {
                "section": section_id,
                "student_breakdown": [
                    {
                        "name": f"{r[0]} {r[1]}", # Combines real First and Last name
                        "user": r[2], 
                        "game": r[3],             # This ensures Phaser knows WHICH game the score is for
                        "avg": float(r[4]) if r[4] is not None else 0.0, 
                        "top": r[5], 
                        "bottom": r[6]
                    } for r in student_stats
                ],
                "section_game_averages": [
                    {"game": r[0], "avg_score": float(r[1]) if r[1] is not None else 0.0} 
                    for r in averages
                ],
                "total_time_records": [
                    {"name": f"{r[0]} {r[1]}", "user": r[2], "game": r[3], "seconds": r[4] or 0} 
                    for r in time_spent
                ]
            }
    finally:
        pool.putconn(conn)

#get all the unique sections for the dropdown filter 
@app.get("/stats/sections/list")
async def get_sections_list():
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT section FROM player_profiles WHERE section IS NOT NULL ORDER BY section ASC")
            sections = [row[0] for row in cur.fetchall()]
        return sections
    finally:
        # This ensures the connection goes back to the pool 
        # even if the query fails.
        pool.putconn(conn)

# admin view 
@app.get("/stats/admin/global-tops")
def get_admin_global():
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(SQL_ADMIN_GLOBAL_TOP_SCORES)
            rows = cur.fetchall()
            return [
                {
                    "game": r[0], 
                    "score": r[1], 
                    "student": f"{r[2]} {r[3]}", 
                    "username": r[4], 
                    "section": r[5]
                } for r in rows
            ]
    finally:
        pool.putconn(conn)


@app.get("/stats/section/{section_id}/csv")
def get_section_csv(section_id: str):
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(SQL_PROF_STUDENT_STATS, (section_id,))
            rows = cur.fetchall()

            # Create an in-memory "file"
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Add the Header Row for Excel
            writer.writerow(["First Name", "Last Name", "Username", "Game", "Avg Score", "Top Score", "Bottom Score"])
            
            # Add the Data Rows
            writer.writerows(rows)
            
            # Rewind the "file" to the beginning and stream it to the browser
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=section_{section_id}_report.csv"}
            )
    finally:
        pool.putconn(conn)

@app.get("/stats/admin/global-tops/csv")
def get_admin_csv():
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(SQL_ADMIN_GLOBAL_TOP_SCORES)
            rows = cur.fetchall()

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Game", "Score", "First Name", "Last Name", "Username", "Section"])
            writer.writerows(rows)
            
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=global_top_scores.csv"}
            )
    finally:
        pool.putconn(conn)



# --- ADMIN: ALL STUDENTS (No Section Filter) ---
@app.get("/stats/admin/all-students")
def get_all_students_admin():
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            # We reuse the Prof query but pass None or a wildcard if your SQL supports it, 
            # OR we use a dedicated "Global" version of that query:
            cur.execute("""
                SELECT p.first_name, p.last_name, p.username, g.game, AVG(g.score), MAX(g.score), MIN(g.score), p.section, SUM(g.time_played) as total_time
                FROM public.player_profiles p
                JOIN public.game_analytics g ON p.username = g.username
                GROUP BY p.first_name, p.last_name, p.username, g.game, p.section
                ORDER BY p.section ASC, p.last_name ASC;
            """)
            rows = cur.fetchall()
            return [
                {
                    "name": f"{r[0]} {r[1]}", 
                    "game": r[3], 
                    "avg": float(r[4]), 
                    "top": r[5], 
                    "bottom": r[6],
                    "section": r[7],
                    "total_time": int(r[8]) if r[8] is not None else 0
                } for r in rows
            ]
    finally:
        pool.putconn(conn)


@app.get("/stats/admin/all-students/csv")
def get_all_students_csv():
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.section, p.first_name, p.last_name, g.game, AVG(g.score), MAX(g.score)
                FROM public.player_profiles p
                JOIN public.game_analytics g ON p.username = g.username
                GROUP BY p.section, p.first_name, p.last_name, g.game
                ORDER BY p.section, p.last_name;
            """)
            rows = cur.fetchall()

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Section", "First Name", "Last Name", "Game", "Avg Score", "High Score"])
            for r in rows:
                writer.writerow([r[0], r[1], r[2], r[3], round(float(r[4]), 2), r[5]])

            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=all_students_report.csv"}
            )
    finally:
        pool.putconn(conn)


@app.post("/api/register-profile")
def register_profile(payload: dict = Body(...)):
    username = payload.get("username").lower()
    first = payload.get("first_name")
    last = payload.get("last_name")
    section = payload.get("section")

    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO public.player_profiles (username, first_name, last_name, section)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (username) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        section = EXCLUDED.section;
                """, (username, first, last, section))
        return {"status": "success"}
    finally:
        pool.putconn(conn)

# clear all student data
@app.delete("/admin/clear-data", tags=["Admin"])
async def clear_data():
    if pool is None:
        raise HTTPException(status_code=500, detail="DB not initialized")
    conn = pool.getconn()
    try:
        with conn:
            with conn.cursor() as cur:
                # previously: cur.execute("TRUNCATE public.game_analytics, public.player_profiles RESTART IDENTITY CASCADE;")
                cur.execute("TRUNCATE public.game_analytics, public.player_profiles CASCADE;")
        return {"status": "success", "message": "All data cleared"}
    finally:
        pool.putconn(conn)