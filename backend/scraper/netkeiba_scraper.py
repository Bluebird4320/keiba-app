"""
netkeiba スクレイパー
JRAレース情報、出走馬、騎手データを取得する
"""

import httpx
import asyncio
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from typing import Optional
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "https://race.netkeiba.com"
DB_URL = "https://db.netkeiba.com"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# JRA 開催場コード
VENUE_CODES = {
    "01": "札幌", "02": "函館", "03": "福島", "04": "新潟",
    "05": "東京", "06": "中山", "07": "中京", "08": "京都",
    "09": "阪神", "10": "小倉",
}

async def fetch_page(client: httpx.AsyncClient, url: str) -> Optional[BeautifulSoup]:
    """ページを非同期取得してBeautifulSoupを返す"""
    try:
        await asyncio.sleep(1.0)  # レート制限: 1秒間隔
        resp = await client.get(url, headers=HEADERS, timeout=15.0, follow_redirects=True)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        logger.error(f"Fetch error {url}: {e}")
        return None


async def get_race_list_by_date(date_str: str) -> list[dict]:
    """
    指定日の全JRAレース一覧を取得
    date_str: "YYYYMMDD"
    returns: [{venue, venue_name, race_no, race_id, race_name, start_time, ...}]
    """
    url = f"{BASE_URL}/top/race_list.html?kaisai_date={date_str}"
    async with httpx.AsyncClient() as client:
        soup = await fetch_page(client, url)
    if not soup:
        return []

    races = []
    # 開催場ごとのブロックを探す
    venue_blocks = soup.select(".RaceList_DataList")
    for block in venue_blocks:
        venue_header = block.find_previous("div", class_="RaceList_DataHeader")
        venue_name = venue_header.get_text(strip=True) if venue_header else "不明"

        for item in block.select(".RaceList_DataItem"):
            a_tag = item.select_one("a")
            if not a_tag:
                continue
            href = a_tag.get("href", "")
            race_id_match = re.search(r"race_id=(\d+)", href)
            if not race_id_match:
                continue
            race_id = race_id_match.group(1)
            race_no_el = item.select_one(".RaceList_ItemTitle")
            race_no = race_no_el.get_text(strip=True) if race_no_el else ""
            time_el = item.select_one(".RaceList_ItemTime")
            start_time = time_el.get_text(strip=True) if time_el else ""

            races.append({
                "race_id": race_id,
                "venue_name": venue_name,
                "race_no": race_no,
                "start_time": start_time,
                "date": date_str,
            })

    return races


async def get_race_detail(race_id: str) -> Optional[dict]:
    """
    レース詳細（出走馬一覧・基本情報）を取得
    """
    url = f"{BASE_URL}/race/shutuba.html?race_id={race_id}"
    async with httpx.AsyncClient() as client:
        soup = await fetch_page(client, url)
    if not soup:
        return None

    # レース名・条件
    race_name_el = soup.select_one(".RaceName")
    race_name = race_name_el.get_text(strip=True) if race_name_el else ""

    race_data_el = soup.select_one(".RaceData01")
    race_conditions = race_data_el.get_text(strip=True) if race_data_el else ""

    race_data2_el = soup.select_one(".RaceData02")
    race_grade = race_data2_el.get_text(strip=True) if race_data2_el else ""

    horses = []
    rows = soup.select(".Shutuba_Table tr.HorseList")
    for row in rows:
        horse = parse_horse_row(row)
        if horse:
            horses.append(horse)

    return {
        "race_id": race_id,
        "race_name": race_name,
        "race_conditions": race_conditions,
        "race_grade": race_grade,
        "horses": horses,
    }


def parse_horse_row(row) -> Optional[dict]:
    """出走馬の1行をパース"""
    try:
        # 馬番
        num_el = row.select_one(".Umaban")
        horse_no = num_el.get_text(strip=True) if num_el else ""

        # 馬名とID
        horse_name_el = row.select_one(".HorseName a")
        horse_name = horse_name_el.get_text(strip=True) if horse_name_el else ""
        horse_href = horse_name_el.get("href", "") if horse_name_el else ""
        horse_id_match = re.search(r"/horse/(\d+)/", horse_href)
        horse_id = horse_id_match.group(1) if horse_id_match else ""

        # 騎手
        jockey_el = row.select_one(".Jockey a")
        jockey_name = jockey_el.get_text(strip=True) if jockey_el else ""
        jockey_href = jockey_el.get("href", "") if jockey_el else ""
        jockey_id_match = re.search(r"/jockey/(\w+)/", jockey_href)
        jockey_id = jockey_id_match.group(1) if jockey_id_match else ""

        # 斤量
        weight_el = row.select_one(".Jockey") 
        # 馬齢・性別
        age_el = row.select_one(".Barei")
        age_sex = age_el.get_text(strip=True) if age_el else ""

        # 馬体重
        horse_weight_el = row.select_one(".Weight")
        horse_weight = horse_weight_el.get_text(strip=True) if horse_weight_el else ""

        # 調教師
        trainer_el = row.select_one(".Trainer a")
        trainer_name = trainer_el.get_text(strip=True) if trainer_el else ""

        # オッズ
        odds_el = row.select_one(".Odds span")
        odds = odds_el.get_text(strip=True) if odds_el else ""

        # 人気
        popular_el = row.select_one(".Popular")
        popular = popular_el.get_text(strip=True) if popular_el else ""

        # 枠番
        bracket_el = row.select_one(".Waku span")
        bracket_no = bracket_el.get_text(strip=True) if bracket_el else ""

        return {
            "horse_no": horse_no,
            "bracket_no": bracket_no,
            "horse_id": horse_id,
            "horse_name": horse_name,
            "age_sex": age_sex,
            "horse_weight": horse_weight,
            "jockey_id": jockey_id,
            "jockey_name": jockey_name,
            "trainer_name": trainer_name,
            "odds": odds,
            "popular": popular,
        }
    except Exception as e:
        logger.error(f"parse_horse_row error: {e}")
        return None


async def get_horse_past_races(horse_id: str, limit: int = 10) -> list[dict]:
    """
    馬の過去レース結果（最大10走）を取得
    """
    url = f"{DB_URL}/horse/{horse_id}/"
    async with httpx.AsyncClient() as client:
        soup = await fetch_page(client, url)
    if not soup:
        return []

    results = []
    table = soup.select_one("table.db_h_race_results")
    if not table:
        return []

    rows = table.select("tbody tr")
    for row in rows[:limit]:
        cols = row.select("td")
        if len(cols) < 12:
            continue
        try:
            results.append({
                "date": cols[0].get_text(strip=True),
                "venue": cols[1].get_text(strip=True),
                "race_name": cols[4].get_text(strip=True),
                "rank": cols[11].get_text(strip=True),
                "jockey": cols[12].get_text(strip=True) if len(cols) > 12 else "",
                "time": cols[17].get_text(strip=True) if len(cols) > 17 else "",
                "odds": cols[18].get_text(strip=True) if len(cols) > 18 else "",
            })
        except Exception:
            continue

    return results


async def get_jockey_info(jockey_id: str) -> dict:
    """
    騎手プロフィール情報を取得
    """
    url = f"{DB_URL}/jockey/{jockey_id}/"
    async with httpx.AsyncClient() as client:
        soup = await fetch_page(client, url)
    if not soup:
        return {}

    info = {}
    # プロフィール
    prof_table = soup.select_one("table.db_prof_table")
    if prof_table:
        for row in prof_table.select("tr"):
            th = row.select_one("th")
            td = row.select_one("td")
            if th and td:
                info[th.get_text(strip=True)] = td.get_text(strip=True)

    # 今年の成績
    stats_table = soup.select_one("table.jockey_result_table")
    if stats_table:
        rows = stats_table.select("tr")
        if len(rows) >= 2:
            headers = [th.get_text(strip=True) for th in rows[0].select("th")]
            for data_row in rows[1:3]:  # 今年・昨年
                vals = [td.get_text(strip=True) for td in data_row.select("td")]
                if vals:
                    info["直近成績_" + vals[0]] = dict(zip(headers[1:], vals[1:]))

    return info


async def get_odds(race_id: str) -> dict:
    """
    リアルタイムオッズを取得（単勝・複勝・馬連・三連複等）
    """
    results = {}
    odds_types = {
        "win": "1",      # 単勝
        "place": "5",    # 複勝
        "quinella": "4", # 馬連
        "exacta": "6",   # 馬単
        "wide": "8",     # ワイド
        "trio": "7",     # 三連複
        "trifecta": "3", # 三連単
    }

    async with httpx.AsyncClient() as client:
        for odds_name, type_code in odds_types.items():
            url = f"https://race.netkeiba.com/odds/index.html?race_id={race_id}&type=b{type_code}"
            soup = await fetch_page(client, url)
            if soup:
                results[odds_name] = parse_odds_table(soup, odds_name)

    return results


def parse_odds_table(soup: BeautifulSoup, odds_type: str) -> list[dict]:
    """オッズテーブルをパース"""
    items = []
    table = soup.select_one("#odds_table, .Odds_Table")
    if not table:
        return items

    for row in table.select("tr"):
        cols = row.select("td")
        if len(cols) >= 2:
            items.append({
                "combination": cols[0].get_text(strip=True),
                "odds": cols[1].get_text(strip=True),
            })
    return items


def get_today_and_tomorrow() -> tuple[str, str]:
    """今日・明日の日付文字列を返す (YYYYMMDD)"""
    today = datetime.now()
    tomorrow = today + timedelta(days=1)
    return today.strftime("%Y%m%d"), tomorrow.strftime("%Y%m%d")
