"""
JRA公式サイト スクレイパー
- 重賞レース一覧: /datafile/seiseki/replay/YYYY/jyusyo.html
- 個別レース結果: /datafile/seiseki/replay/YYYY/NNN.html
取得したデータをSQLiteに保存する
"""

import httpx
import asyncio
import re
import time
import logging
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.database import get_connection, init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

BASE_URL = "https://www.jra.go.jp"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}
INTERVAL_SEC = 2.0  # リクエスト間隔（サーバー負荷対策）


def fetch(url: str) -> Optional[BeautifulSoup]:
    """同期HTTPリクエスト＋BeautifulSoup（Shift-JIS対応）"""
    try:
        time.sleep(INTERVAL_SEC)
        r = httpx.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
        r.raise_for_status()
        r.encoding = "shift_jis"
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        logger.error(f"Fetch error {url}: {e}")
        return None


# =============================================
# 重賞一覧の取得
# =============================================

def scrape_grade_race_list(year: int) -> list[dict]:
    """
    重賞レース一覧ページから全レースのURL・基本情報を取得
    """
    url = f"{BASE_URL}/datafile/seiseki/replay/{year}/jyusyo.html"
    logger.info(f"重賞一覧取得: {url}")
    soup = fetch(url)
    if not soup:
        return []

    races = []
    table = soup.select_one("table")
    if not table:
        logger.warning("テーブルが見つかりません")
        return []

    rows = table.select("tr")
    for row in rows[1:]:  # ヘッダー行をスキップ
        cols = row.select("td")
        if len(cols) < 8:
            continue
        try:
            # 列: 月日 | 曜日 | グレード | レース名 | 競馬場 | 性齢 | 芝/ダ | 距離 | m | 優勝馬 | 騎手 | 結果リンク
            race_date  = cols[0].get_text(strip=True)
            grade      = cols[2].get_text(strip=True)
            race_name  = cols[3].get_text(strip=True)
            venue      = cols[4].get_text(strip=True)
            sex_age    = cols[5].get_text(strip=True)
            surface    = cols[6].get_text(strip=True)
            dist_text  = cols[7].get_text(strip=True)
            distance   = int(dist_text) if dist_text.isdigit() else None

            # 優勝馬・騎手（列数が足りる場合）
            winner_name   = cols[9].get_text(strip=True) if len(cols) > 9 else ""
            winner_jockey = cols[10].get_text(strip=True) if len(cols) > 10 else ""

            # 結果リンク
            result_link = ""
            for a in row.select("a[href]"):
                href = a.get("href", "")
                if "replay" in href and href.endswith(".html"):
                    result_link = href if href.startswith("http") else BASE_URL + href
                    break

            if not result_link:
                continue

            races.append({
                "year":           year,
                "race_date":      race_date,
                "grade":          grade,
                "race_name":      race_name,
                "venue":          venue,
                "sex_age":        sex_age,
                "surface":        surface,
                "distance":       distance,
                "winner_name":    winner_name,
                "winner_jockey":  winner_jockey,
                "race_url":       result_link,
            })
        except Exception as e:
            logger.warning(f"行パースエラー: {e}")
            continue

    logger.info(f"  → {len(races)}件取得")
    return races


# =============================================
# 個別レース結果の取得
# =============================================

def _parse_weight(text: str) -> tuple[Optional[int], Optional[int]]:
    """
    "478(+2)" → (478, 2)
    "484(-4)" → (484, -4)
    """
    m = re.search(r"(\d+)\(([+-]?\d+)\)", text)
    if m:
        return int(m.group(1)), int(m.group(2))
    if text.isdigit():
        return int(text), None
    return None, None


def scrape_race_result(race_url: str) -> Optional[dict]:
    """
    個別レース結果ページから着順データを取得
    """
    logger.info(f"  結果取得: {race_url}")
    soup = fetch(race_url)
    if not soup:
        return None

    tables = soup.select("table")
    if not tables:
        return None

    results = []
    result_table = tables[0]
    rows = result_table.select("tr")

    for row in rows[1:]:  # ヘッダースキップ
        cols = row.select("td")
        if len(cols) < 10:
            continue
        try:
            rank_text = cols[0].get_text(strip=True)
            rank = int(rank_text) if rank_text.isdigit() else None

            bracket_text = cols[1].get_text(strip=True)
            bracket_no = int(bracket_text) if bracket_text.isdigit() else None

            horse_no_text = cols[2].get_text(strip=True)
            horse_no = int(horse_no_text) if horse_no_text.isdigit() else None

            horse_name   = cols[3].get_text(strip=True)
            sex_age      = cols[4].get_text(strip=True)
            burden_text  = cols[5].get_text(strip=True)
            burden_weight = float(burden_text) if burden_text else None
            jockey_name  = cols[6].get_text(strip=True)
            finish_time  = cols[7].get_text(strip=True)
            margin       = cols[8].get_text(strip=True)

            # コーナー通過順位（複数列）
            corner_cols  = cols[9:13] if len(cols) > 12 else []
            corner_order = "-".join(c.get_text(strip=True) for c in corner_cols if c.get_text(strip=True))

            # 上り3F
            last3f_text = cols[13].get_text(strip=True) if len(cols) > 13 else ""
            last_3f = float(last3f_text) if last3f_text.replace(".", "").isdigit() else None

            # 馬体重（増減）
            weight_text = cols[14].get_text(strip=True) if len(cols) > 14 else ""
            diff_text   = cols[15].get_text(strip=True) if len(cols) > 15 else ""
            horse_weight = int(weight_text) if weight_text.isdigit() else None
            # 増減は "(+2)" 形式の場合も
            weight_diff = None
            if diff_text:
                m = re.search(r"([+-]?\d+)", diff_text)
                if m:
                    weight_diff = int(m.group(1))

            trainer_name = cols[16].get_text(strip=True) if len(cols) > 16 else ""

            # 単勝・人気
            odds_text    = cols[17].get_text(strip=True) if len(cols) > 17 else ""
            popular_text = cols[18].get_text(strip=True) if len(cols) > 18 else ""
            win_odds  = float(odds_text)    if odds_text.replace(".", "").isdigit()  else None
            popular   = int(popular_text)   if popular_text.isdigit()                else None

            results.append({
                "rank":          rank,
                "bracket_no":    bracket_no,
                "horse_no":      horse_no,
                "horse_name":    horse_name,
                "sex_age":       sex_age,
                "burden_weight": burden_weight,
                "jockey_name":   jockey_name,
                "finish_time":   finish_time,
                "margin":        margin,
                "corner_order":  corner_order,
                "last_3f":       last_3f,
                "horse_weight":  horse_weight,
                "weight_diff":   weight_diff,
                "trainer_name":  trainer_name,
                "win_odds":      win_odds,
                "popular":       popular,
            })
        except Exception as e:
            logger.warning(f"    行パースエラー: {e}")
            continue

    # ラップタイム
    lap_time = ""
    last_3f_overall = ""
    if len(tables) > 1:
        lap_rows = tables[1].select("tr")
        for lr in lap_rows:
            text = lr.get_text(strip=True)
            if "ハロンタイム" in text or re.search(r"\d+\.\d+ - \d+\.\d+", text):
                lap_time = re.sub(r"ハロンタイム", "", text).strip()
            if "上り" in text:
                last_3f_overall = text

    return {
        "results":          results,
        "lap_time":         lap_time,
        "last_3f_overall":  last_3f_overall,
    }


# =============================================
# DBへの保存
# =============================================

def save_race_to_db(race_info: dict, result_data: Optional[dict]) -> int:
    """レース情報と着順をDBに保存。race.idを返す"""
    conn = get_connection()
    try:
        lap_time = result_data.get("lap_time", "") if result_data else ""

        # races テーブル（重複はスキップ）
        conn.execute("""
            INSERT OR IGNORE INTO races
              (race_url, year, race_date, race_name, venue, grade,
               sex_age, surface, distance, winner_name, winner_jockey, lap_time)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            race_info["race_url"],
            race_info["year"],
            race_info["race_date"],
            race_info["race_name"],
            race_info["venue"],
            race_info["grade"],
            race_info["sex_age"],
            race_info["surface"],
            race_info["distance"],
            race_info["winner_name"],
            race_info["winner_jockey"],
            lap_time,
        ))

        race_row = conn.execute(
            "SELECT id FROM races WHERE race_url = ?", (race_info["race_url"],)
        ).fetchone()
        race_id = race_row["id"]

        # 既に着順が登録済みならスキップ
        existing = conn.execute(
            "SELECT COUNT(*) as cnt FROM race_results WHERE race_id = ?", (race_id,)
        ).fetchone()["cnt"]

        if existing == 0 and result_data and result_data.get("results"):
            for r in result_data["results"]:
                conn.execute("""
                    INSERT INTO race_results
                      (race_id, rank, bracket_no, horse_no, horse_name, sex_age,
                       burden_weight, jockey_name, finish_time, margin, corner_order,
                       last_3f, horse_weight, weight_diff, trainer_name, win_odds, popular)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    race_id,
                    r["rank"], r["bracket_no"], r["horse_no"], r["horse_name"],
                    r["sex_age"], r["burden_weight"], r["jockey_name"],
                    r["finish_time"], r["margin"], r["corner_order"],
                    r["last_3f"], r["horse_weight"], r["weight_diff"],
                    r["trainer_name"], r["win_odds"], r["popular"],
                ))

            # 馬マスター更新
            for r in result_data["results"]:
                if r["horse_name"] and r["sex_age"]:
                    sex = r["sex_age"][0] if r["sex_age"] else ""
                    conn.execute("""
                        INSERT OR IGNORE INTO horses (name, sex) VALUES (?,?)
                    """, (r["horse_name"], sex))

            # 騎手マスター更新
            for r in result_data["results"]:
                if r["jockey_name"]:
                    conn.execute("""
                        INSERT OR IGNORE INTO jockeys (name) VALUES (?)
                    """, (r["jockey_name"],))

        conn.commit()
        return race_id
    except Exception as e:
        conn.rollback()
        logger.error(f"DB保存エラー: {e}")
        return -1
    finally:
        conn.close()


# =============================================
# メイン処理
# =============================================

def scrape_year(year: int, max_races: Optional[int] = None):
    """指定年の全重賞レースをスクレイピングしてDBに保存"""
    logger.info(f"===== {year}年 重賞データ取得開始 =====")
    init_db()

    races = scrape_grade_race_list(year)
    if not races:
        logger.warning("レース情報なし")
        return

    total = len(races)
    if max_races:
        races = races[:max_races]
        logger.info(f"最初の{max_races}件のみ取得（全{total}件）")

    saved = 0
    skipped = 0
    for i, race in enumerate(races, 1):
        logger.info(f"[{i}/{len(races)}] {race['race_date']} {race['race_name']} ({race['venue']})")

        # 既にDBにあればスキップ
        conn = get_connection()
        exists = conn.execute(
            "SELECT id FROM races WHERE race_url = ?", (race["race_url"],)
        ).fetchone()
        has_results = False
        if exists:
            cnt = conn.execute(
                "SELECT COUNT(*) as cnt FROM race_results WHERE race_id = ?", (exists["id"],)
            ).fetchone()["cnt"]
            has_results = cnt > 0
        conn.close()

        if exists and has_results:
            logger.info(f"  → スキップ（取得済み）")
            skipped += 1
            continue

        # 結果を取得
        result_data = scrape_race_result(race["race_url"])
        race_id = save_race_to_db(race, result_data)

        if race_id > 0:
            n = len(result_data["results"]) if result_data else 0
            logger.info(f"  → 保存完了 (race_id={race_id}, {n}頭)")
            saved += 1
        else:
            logger.warning(f"  → 保存失敗")

    logger.info(f"===== 完了: 新規{saved}件保存, {skipped}件スキップ =====")


def scrape_multi_year(start_year: int, end_year: int):
    """複数年分を一括取得"""
    for year in range(start_year, end_year + 1):
        scrape_year(year)
        time.sleep(3)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="JRA重賞スクレイパー")
    parser.add_argument("--year",  type=int, default=datetime.now().year, help="対象年")
    parser.add_argument("--years", type=int, nargs=2, metavar=("FROM", "TO"), help="複数年 例: --years 2020 2026")
    parser.add_argument("--max",   type=int, default=None, help="最大取得件数（テスト用）")
    args = parser.parse_args()

    if args.years:
        scrape_multi_year(args.years[0], args.years[1])
    else:
        scrape_year(args.year, args.max)
