"""
JRA公式リアルタイムデータ取得
- 今週・来週の開催レース一覧
- 各レースの出走馬情報
"""

import httpx
import re
import time
import logging
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "https://www.jra.go.jp"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}


def fetch(url: str, encoding: str = "shift_jis") -> Optional[BeautifulSoup]:
    try:
        time.sleep(1.0)
        r = httpx.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
        r.raise_for_status()
        r.encoding = encoding
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        logger.error(f"Fetch error {url}: {e}")
        return None


# =============================================
# 今週の開催情報取得
# =============================================

def get_thisweek_kaisai() -> list[dict]:
    """
    thisweek ページから今週の開催情報を取得
    returns: [
      {
        "date": "20260321",
        "date_label": "3月21日（土曜）",
        "kaisai_key": "0321_1",    # URLの開催キー
        "venue": "中山",
        "race_name": "フラワーカップ（GⅢ）",
        "url": "https://www.jra.go.jp/keiba/thisweek/2026/0321_1/index.html"
      }
    ]
    """
    soup = fetch(f"{BASE_URL}/keiba/thisweek/")
    if not soup:
        return []

    kaisai_list = []
    year = datetime.now().year

    for a in soup.select("a[href]"):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        # 例: 2026/0321_1/index.html
        m = re.search(r"(\d{4})/(\d{4}_\d+)/index\.html", href)
        if not m:
            continue

        link_year = int(m.group(1))
        kaisai_key = m.group(2)  # "0321_1"
        date_part = kaisai_key[:4]  # "0321"
        month = int(date_part[:2])
        day = int(date_part[2:])
        date_str = f"{link_year}{month:02d}{day:02d}"

        # テキストから開催場を抽出
        venue = ""
        for v in ["東京", "中山", "阪神", "京都", "中京", "小倉", "福島", "新潟", "札幌", "函館"]:
            if v in text:
                venue = v
                break

        # 日付ラベル
        date_label_m = re.search(r"(\d+月\d+日[（(][^）)]+[）)])", text)
        date_label = date_label_m.group(1) if date_label_m else f"{month}月{day}日"

        full_url = f"{BASE_URL}/keiba/thisweek/{link_year}/{kaisai_key}/index.html"

        kaisai_list.append({
            "date":        date_str,
            "date_label":  date_label,
            "kaisai_key":  kaisai_key,
            "venue":       venue,
            "feature_race": text,
            "url":         full_url,
        })

    logger.info(f"今週の開催: {len(kaisai_list)}件")
    return kaisai_list


# =============================================
# 開催別・全レース一覧取得
# =============================================

def get_race_list_from_kaisai(kaisai: dict) -> list[dict]:
    """
    開催ページから全レース番号と基本情報を取得
    """
    soup = fetch(kaisai["url"])
    if not soup:
        return []

    year = kaisai["date"][:4]
    kaisai_key = kaisai["kaisai_key"]
    races = []

    # レース番号リンクを探す（例: race/shutuba.html?race_id=...）
    # またはページ内のレース番号テーブル
    race_links = []

    # パターン1: race_id形式のリンク
    for a in soup.select("a[href*='race_id']"):
        href = a.get("href", "")
        m = re.search(r"race_id=(\d+)", href)
        if m:
            race_links.append(m.group(1))

    # パターン2: shutuba.html リンク
    for a in soup.select("a[href*='shutuba']"):
        href = a.get("href", "")
        m = re.search(r"race_id=(\d+)", href)
        if m:
            race_links.append(m.group(1))

    if race_links:
        for race_id in set(race_links):
            races.append({
                "race_id":    race_id,
                "date":       kaisai["date"],
                "venue":      kaisai["venue"],
                "kaisai_key": kaisai_key,
            })
        return races

    # パターン3: ページ内テキストからレース番号を推測
    # 開催場コードからrace_idを生成
    VENUE_TO_CODE = {
        "札幌": "01", "函館": "02", "福島": "03", "新潟": "04",
        "東京": "05", "中山": "06", "中京": "07", "京都": "08",
        "阪神": "09", "小倉": "10",
    }
    venue_code = VENUE_TO_CODE.get(kaisai["venue"], "05")

    # 開催回・日目をkaisai_keyから推測
    kai_num = kaisai_key[-1]  # "0321_1" → "1"

    # JRAのrace_id形式: YYYYKAIBASEINICHI_RACE
    # 例: 2026030511 = 2026年3回中山5日目1R
    # thisweekのURLからkaisai_keyで推測するのは難しいので
    # 代わりにnetkeiba形式でrace_listを使う
    # 今週はモック→実際のrace_idが必要なためDBベースで対応

    logger.warning(f"race_idリンクが見つかりません: {kaisai['url']}")
    return []


# =============================================
# 今週の全レース取得（開催場×日付）
# =============================================

def get_week_races() -> dict:
    """
    今週・来週の全開催レース情報を返す
    {
      "20260321": {
        "中山": [{"race_no": "1R", "race_name": "...", "race_id": "..."}],
        "中京": [...],
      },
      "20260322": {...}
    }
    """
    kaisai_list = get_thisweek_kaisai()
    if not kaisai_list:
        return {}

    # 日付×開催場でグループ化
    result = {}
    dates_venues = {}

    for k in kaisai_list:
        date = k["date"]
        venue = k["venue"]
        if date not in dates_venues:
            dates_venues[date] = set()
        if venue:
            dates_venues[date].add(venue)

    # 各日付・開催場のレース一覧を構築
    # race_idはnetkeiba形式を使用（thisweekページから取得）
    for k in kaisai_list:
        date = k["date"]
        venue = k["venue"]
        if not venue:
            continue

        if date not in result:
            result[date] = {}
        if venue not in result[date]:
            result[date][venue] = []

        # 注目レース情報を追加
        result[date][venue].append({
            "race_no":    "注目",
            "race_name":  k["feature_race"],
            "race_id":    f"feature_{k['kaisai_key']}",
            "start_time": "",
            "date":       date,
            "venue_name": venue,
            "is_feature": True,
        })

    return result


# =============================================
# netkeiba race_id形式でのレース取得
# =============================================

VENUE_TO_NETKEIBA_CODE = {
    "札幌": "01", "函館": "02", "福島": "03", "新潟": "04",
    "東京": "05", "中山": "06", "中京": "07", "京都": "08",
    "阪神": "09", "小倉": "10",
}


def build_race_ids_for_date(date_str: str, venues_and_rounds: list[tuple]) -> list[dict]:
    """
    date_str: "20260321"
    venues_and_rounds: [("中山", 3, 5), ("中京", 5, 1)]  # (開催場, 回, 日目)
    """
    races = []
    for venue, kai, nichi in venues_and_rounds:
        code = VENUE_TO_NETKEIBA_CODE.get(venue, "05")
        for race_no in range(1, 13):
            # JRA race_id: YYYY + 場コード + 回 + 日目 + レース番号
            race_id = f"{date_str[:4]}{code}{kai:02d}{nichi:02d}{race_no:02d}"
            races.append({
                "race_id":    race_id,
                "race_no":    f"{race_no}R",
                "race_name":  f"{venue} {race_no}R",
                "venue_name": venue,
                "date":       date_str,
                "start_time": "",
            })
    return races


# =============================================
# JRA公式出馬表PDFリンクから開催情報取得
# =============================================

def get_kaisai_from_rpdf() -> dict:
    """
    rpdf（開催場別出馬表）ページから今週の開催場・日付を取得
    returns: {"20260321": ["中山", "中京", "阪神"], "20260322": [...]}
    """
    soup = fetch(f"{BASE_URL}/keiba/rpdf/")
    if not soup:
        return {}

    year = datetime.now().year
    result = {}
    today = datetime.now()

    # 直近2週間分の日付×開催場を探す
    text = soup.get_text(separator="\n", strip=True)

    # 日付とその後に続く開催場を抽出
    date_venue_pattern = re.compile(
        r'(\d{1,2})月(\d{1,2})日.*?(東京|中山|阪神|京都|中京|小倉|福島|新潟|札幌|函館)',
        re.DOTALL
    )

    for m in date_venue_pattern.finditer(text):
        month = int(m.group(1))
        day   = int(m.group(2))
        venue = m.group(3)
        date_str = f"{year}{month:02d}{day:02d}"

        # 直近14日以内のみ
        try:
            d = datetime(year, month, day)
            if abs((d - today).days) <= 14:
                if date_str not in result:
                    result[date_str] = []
                if venue not in result[date_str]:
                    result[date_str].append(venue)
        except:
            pass

    # aタグからも取得
    for a in soup.select("a[href]"):
        text_a = a.get_text(strip=True)
        m = re.search(r'(\d{1,2})月(\d{1,2})日', text_a)
        venue_m = re.search(r'東京|中山|阪神|京都|中京|小倉|福島|新潟|札幌|函館', text_a)
        if m and venue_m:
            month = int(m.group(1))
            day   = int(m.group(2))
            venue = venue_m.group(0)
            date_str = f"{year}{month:02d}{day:02d}"
            try:
                d = datetime(year, month, day)
                if abs((d - today).days) <= 14:
                    if date_str not in result:
                        result[date_str] = []
                    if venue not in result[date_str]:
                        result[date_str].append(venue)
            except:
                pass

    logger.info(f"開催情報: {result}")
    return result


if __name__ == "__main__":
    print("=== 今週の開催情報 ===")
    kaisai = get_thisweek_kaisai()
    for k in kaisai:
        print(f"  {k['date']} {k['venue']} {k['feature_race'][:40]}")

    print("\n=== rpdfから開催場取得 ===")
    rpdf = get_kaisai_from_rpdf()
    for date, venues in sorted(rpdf.items()):
        print(f"  {date}: {venues}")
