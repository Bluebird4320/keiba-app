"""
競馬データ取得モジュール（keibalab.jp/db/race/ 対応版）
今週の開催情報・レース一覧を keibalab から取得
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

BASE_URL  = "https://www.jra.go.jp"
KEIBALAB  = "https://www.keibalab.jp"
HEADERS   = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
}

VENUE_CODES = {
    "01": "札幌", "02": "函館", "03": "福島", "04": "新潟",
    "05": "東京", "06": "中山", "07": "中京", "08": "京都",
    "09": "阪神", "10": "小倉",
}
VENUE_TO_CODE = {v: k for k, v in VENUE_CODES.items()}
ALL_VENUES    = list(VENUE_TO_CODE.keys())


def _fetch(url: str, encoding: str = "utf-8") -> Optional[BeautifulSoup]:
    try:
        time.sleep(0.8)
        r = httpx.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
        r.raise_for_status()
        r.encoding = encoding
        return BeautifulSoup(r.text, "lxml")
    except Exception as e:
        logger.error(f"Fetch error {url}: {e}")
        return None


# =============================================
# keibalab からレース一覧を取得
# =============================================

def _parse_keibalab_race_list(date_str: str) -> list:
    """
    keibalab の日付別レース一覧ページをパース
    URL: https://www.keibalab.jp/db/race/YYYYMMDD/
    """
    url  = f"{KEIBALAB}/db/race/{date_str}/"
    soup = _fetch(url)
    if not soup:
        # 今日のデフォルトページ（/db/race/）も試す
        if date_str == datetime.now().strftime("%Y%m%d"):
            soup = _fetch(f"{KEIBALAB}/db/race/")
        if not soup:
            return []

    races  = []
    year   = date_str[:4]
    month  = int(date_str[4:6])
    day    = int(date_str[6:8])

    # 開催場ブロックを探す（"2回中山7日目" "1回阪神9日目" など）
    text  = soup.get_text(separator="\n", strip=True)
    lines = text.split("\n")

    current_venue    = None
    current_kai_nichi = ""
    current_baba      = ""

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # 開催場ブロック検出: "2回中山7日目" パターン
        kai_match = re.search(r"(\d+)回(.+?)(\d+)日目", line)
        if kai_match:
            venue_cand = kai_match.group(2).strip()
            for v in ALL_VENUES:
                if v in venue_cand:
                    current_venue = v
                    current_kai_nichi = line
                    break
            i += 1
            continue

        # 馬場状態: "天候：晴 芝：良 ダ：稍重"
        if "天候" in line and ("芝" in line or "ダ" in line):
            current_baba = line
            i += 1
            continue

        # レース番号: "1R" "2R" ...
        r_match = re.match(r"^(\d{1,2})R$", line)
        if r_match and current_venue:
            race_no  = int(r_match.group(1))
            # 次の行から発走時刻・レース名を取得
            start_time = ""
            race_name  = ""
            conditions = ""

            for j in range(i + 1, min(i + 6, len(lines))):
                l = lines[j].strip()
                if not l:
                    continue
                if re.match(r"\d{1,2}:\d{2}", l) and not start_time:
                    start_time = l
                elif re.search(r"サラ系|障害|3歳|4歳|未勝利|1勝|2勝|3勝|OP|GⅠ|GⅡ|GⅢ|オープン", l) and not race_name:
                    race_name = l
                elif re.search(r"[芝ダ]\d{3,4}m", l) and not conditions:
                    conditions = l

            # race_id 生成
            kai_m = re.search(r"(\d+)回.+?(\d+)日目", current_kai_nichi)
            kai   = int(kai_m.group(1)) if kai_m else 1
            nichi = int(kai_m.group(2)) if kai_m else 1
            code  = VENUE_TO_CODE.get(current_venue, "05")
            race_id = f"{year}{code}{kai:02d}{nichi:02d}{race_no:02d}"

            races.append({
                "race_id":    race_id,
                "venue_name": current_venue,
                "race_no":    f"{race_no}R",
                "race_name":  race_name or f"{current_venue}{race_no}R",
                "start_time": start_time,
                "conditions": conditions,
                "baba":       current_baba,
                "date":       date_str,
            })
            i += 1
            continue

        i += 1

    logger.info(f"  {date_str}: {len(races)}レース取得")
    return races


def _get_this_week_dates() -> list:
    """今週末（土日）の日付リストを返す"""
    today  = datetime.now()
    result = []

    # 今日・明日を含む直近の土日を探す
    for delta in range(0, 8):
        d = today + timedelta(days=delta)
        if d.weekday() in [5, 6]:  # 土=5, 日=6
            result.append(d.strftime("%Y%m%d"))
        if len(result) >= 2:
            break

    # 今日・明日も追加（平日開催もあるため）
    for delta in [0, 1]:
        d = (today + timedelta(days=delta)).strftime("%Y%m%d")
        if d not in result:
            result.append(d)

    return sorted(set(result))


# =============================================
# 公開 API
# =============================================

async def get_race_list_by_date(date_str: str) -> list:
    """指定日のJRAレース一覧を返す（keibalab実データ）"""
    races = _parse_keibalab_race_list(date_str)

    # keibalab から取得できなかった場合は空を返す
    if not races:
        logger.warning(f"{date_str}: レースデータ取得できず")
    return races


async def get_race_detail(race_id: str) -> Optional[dict]:
    """レース詳細（出走馬込み）- モックデータ"""
    import random

    date_str   = race_id[:8]
    venue_code = race_id[8:10]
    race_no_s  = race_id[12:14] if len(race_id) >= 14 else "01"
    race_no    = int(race_no_s)
    venue_name = VENUE_CODES.get(venue_code, "東京")

    SURFACE_OPTIONS  = ["芝", "ダート"]
    DISTANCE_OPTIONS = [1200, 1400, 1600, 1800, 2000, 2200, 2400]
    GRADE_OPTIONS    = ["未勝利", "1勝クラス", "2勝クラス", "3勝クラス", "OP", "GⅢ", "GⅡ", "GⅠ"]
    HORSE_NAMES = [
        "ディープインパクト", "オルフェーヴル", "アーモンドアイ", "キタサンブラック",
        "ゴールドシップ", "ウオッカ", "ダイワスカーレット", "テイエムオペラオー",
        "サイレンススズカ", "グラスワンダー", "エルコンドルパサー", "スペシャルウィーク",
        "ブエナビスタ", "ヴィクトワールピサ", "ローズキングダム", "ヒシアマゾン",
        "ナリタブライアン", "ミホノブルボン", "シンボリルドルフ", "トウカイテイオー",
    ]
    JOCKEY_NAMES  = ["武豊", "川田将雅", "C.ルメール", "M.デムーロ", "福永祐一",
                     "岩田康誠", "横山典弘", "松山弘平", "池添謙一", "戸崎圭太"]
    TRAINER_NAMES = ["藤沢和雄", "池江泰寿", "音無秀孝", "友道康夫", "矢作芳人",
                     "国枝栄", "堀宣行", "高野友和", "中内田充正", "角居勝彦"]

    surface   = random.choice(SURFACE_OPTIONS)
    distance  = random.choice(DISTANCE_OPTIONS)
    grade     = random.choice(GRADE_OPTIONS)
    num_horses = random.randint(10, 18)
    popular_order = list(range(1, num_horses + 1))
    random.shuffle(popular_order)

    def make_odds(popular):
        bases = [1.5, 3.2, 5.5, 8.8, 13.0, 19.0, 28.0, 40.0, 58.0, 80.0,
                 110.0, 150.0, 200.0, 280.0, 380.0, 500.0, 650.0, 900.0]
        b = bases[min(popular - 1, len(bases) - 1)]
        return str(round(b + b * 0.05, 1))

    horses = []
    for i in range(num_horses):
        horse_no = i + 1
        popular  = popular_order[i]
        bracket  = min(((horse_no - 1) // 2) + 1, 8)
        age      = random.randint(3, 7)
        sex      = random.choice(["牡", "牝", "騸"])
        w        = random.randint(440, 530)
        dw       = random.randint(-6, 6)
        horses.append({
            "horse_no":     str(horse_no),
            "bracket_no":   str(bracket),
            "horse_id":     f"horse_{race_id}_{horse_no:02d}",
            "horse_name":   HORSE_NAMES[(horse_no - 1) % len(HORSE_NAMES)],
            "age_sex":      f"{sex}{age}",
            "horse_weight": f"{w}({'+' if dw > 0 else ''}{dw})",
            "jockey_id":    f"jockey_{popular:03d}",
            "jockey_name":  JOCKEY_NAMES[(popular - 1) % len(JOCKEY_NAMES)],
            "trainer_name": TRAINER_NAMES[(horse_no - 1) % len(TRAINER_NAMES)],
            "odds":         make_odds(popular),
            "popular":      str(popular),
            "past_races":   [],
            "jockey_info":  {},
        })

    return {
        "race_id":         race_id,
        "race_name":       f"{venue_name}{race_no}R {grade}",
        "race_conditions": f"{surface}{distance}m / {grade} / 定量",
        "race_grade":      f"{venue_name}競馬場 第{race_no}レース",
        "venue_name":      venue_name,
        "surface":         surface,
        "distance":        distance,
        "horses":          horses,
    }


async def get_horse_past_races(horse_id: str, limit: int = 10) -> list:
    import random
    PAST_RACES = ["有馬記念", "日本ダービー", "天皇賞春", "天皇賞秋", "ジャパンカップ",
                  "宝塚記念", "大阪杯", "皐月賞", "菊花賞", "オークス",
                  "桜花賞", "秋華賞", "スプリンターズS", "マイルCS", "エリザベス女王杯"]
    results = []
    today = datetime.now()
    for _ in range(limit):
        d    = today - timedelta(days=random.randint(20, 400))
        rank = random.choices(range(1, 11), weights=[15, 12, 11, 10, 9, 8, 7, 7, 7, 14])[0]
        results.append({
            "date":      d.strftime("%Y/%m/%d"),
            "venue":     random.choice(list(VENUE_CODES.values())),
            "race_name": random.choice(PAST_RACES),
            "rank":      str(rank),
            "jockey":    random.choice(["武豊", "川田将雅", "C.ルメール", "M.デムーロ"]),
            "time":      f"1:{random.uniform(32, 58):.1f}",
            "odds":      str(round(random.uniform(1.5, 50.0), 1)),
        })
    return results


async def get_jockey_info(jockey_id: str) -> dict:
    import random
    JOCKEY_NAMES = ["武豊", "川田将雅", "C.ルメール", "M.デムーロ", "福永祐一",
                    "岩田康誠", "横山典弘", "松山弘平", "池添謙一", "戸崎圭太"]
    idx  = int(jockey_id.split("_")[-1]) % len(JOCKEY_NAMES)
    name = JOCKEY_NAMES[idx]
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from db.database import get_connection
        conn  = get_connection()
        rows  = conn.execute(
            "SELECT rr.rank, r.grade FROM race_results rr "
            "JOIN races r ON rr.race_id = r.id WHERE rr.jockey_name = ? LIMIT 30",
            (name,)
        ).fetchall()
        conn.close()
        if rows:
            total = len(rows)
            wins  = sum(1 for r in rows if r["rank"] == 1)
            return {"氏名": name, "重賞出走": total, "重賞勝利": wins,
                    "勝率": f"{wins/total*100:.0f}%"}
    except Exception:
        pass
    return {"氏名": name, "所属": random.choice(["栗東", "美浦"])}


async def get_odds(race_id: str) -> dict:
    import random
    num    = random.randint(10, 16)
    horses = [str(i) for i in range(1, num + 1)]

    def o(i):
        bases = [1.5, 3.2, 5.5, 8.8, 13.0, 19.0, 28.0, 40.0, 58.0, 80.0,
                 110.0, 150.0, 200.0, 280.0, 380.0, 500.0]
        b = bases[min(i, len(bases) - 1)]
        return str(round(b + b * 0.05, 1))

    win      = [{"combination": h, "odds": o(i)} for i, h in enumerate(horses)]
    place    = [{"combination": h, "odds": str(round(float(o(i)) * 0.3, 1))} for i, h in enumerate(horses)]
    quinella = [{"combination": f"{horses[i]}-{horses[j]}",
                 "odds": str(round(float(o(i)) * float(o(j)) * 0.4, 1))}
                for i in range(len(horses)) for j in range(i + 1, min(i + 6, len(horses)))]
    wide     = [{"combination": f"{horses[i]}-{horses[j]}",
                 "odds": str(round(float(o(i)) * float(o(j)) * 0.2, 1))}
                for i in range(len(horses)) for j in range(i + 1, min(i + 6, len(horses)))]
    trio     = [{"combination": f"{horses[i]}-{horses[j]}-{horses[k]}",
                 "odds": str(round(float(o(i)) * float(o(j)) * float(o(k)) * 0.3, 1))}
                for i in range(min(5, len(horses)))
                for j in range(i + 1, min(6, len(horses)))
                for k in range(j + 1, min(7, len(horses)))]

    return {"win": win, "place": place, "quinella": quinella[:30],
            "wide": wide[:30], "trio": trio[:35], "exacta": [], "trifecta": []}


def get_today_and_tomorrow() -> tuple:
    today    = datetime.now()
    tomorrow = today + timedelta(days=1)
    return today.strftime("%Y%m%d"), tomorrow.strftime("%Y%m%d")
