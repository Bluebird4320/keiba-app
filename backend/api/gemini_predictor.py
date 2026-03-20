"""
Gemini API 連携 - 競馬予想AI（DB連携強化版）
DBの過去重賞成績データをプロンプトに組み込んで予想精度を向上
"""

import google.generativeai as genai
import os
import json
import logging
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def setup_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY が設定されていません")
    genai.configure(api_key=api_key)


# =============================================
# DB から追加情報を取得
# =============================================

def get_horse_db_stats(horse_name: str, surface: str = "", distance: int = 0) -> dict:
    """
    DBから馬の重賞成績統計を取得
    - 重賞出走回数・勝利数
    - 同距離・同馬場での成績
    - 直近3走の成績
    """
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from db.database import get_connection

        conn = get_connection()

        # 全重賞成績
        all_results = conn.execute("""
            SELECT rr.rank, rr.finish_time, rr.last_3f, rr.win_odds, rr.popular,
                   r.race_name, r.race_date, r.venue, r.grade, r.surface, r.distance
            FROM race_results rr
            JOIN races r ON rr.race_id = r.id
            WHERE rr.horse_name = ?
            ORDER BY r.id DESC
            LIMIT 10
        """, (horse_name,)).fetchall()

        if not all_results:
            conn.close()
            return {}

        total = len(all_results)
        wins = sum(1 for r in all_results if r["rank"] == 1)
        top3 = sum(1 for r in all_results if r["rank"] and r["rank"] <= 3)

        # 同距離±200m での成績
        dist_results = []
        if distance:
            dist_results = [r for r in all_results
                           if r["distance"] and abs(r["distance"] - distance) <= 200]

        # 同馬場での成績
        surface_results = []
        if surface:
            surface_results = [r for r in all_results if r["surface"] == surface]

        # 直近3走
        recent3 = [
            f"{r['race_name']}({r['grade']}) {r['rank']}着 {r['finish_time']}"
            for r in all_results[:3]
        ]

        conn.close()
        return {
            "total_races":     total,
            "wins":            wins,
            "top3":            top3,
            "win_rate":        f"{wins/total*100:.0f}%" if total else "0%",
            "top3_rate":       f"{top3/total*100:.0f}%" if total else "0%",
            "dist_record":     f"{sum(1 for r in dist_results if r['rank']==1)}勝/{len(dist_results)}戦" if dist_results else "実績なし",
            "surface_record":  f"{sum(1 for r in surface_results if r['rank']==1)}勝/{len(surface_results)}戦" if surface_results else "実績なし",
            "recent3":         recent3,
        }
    except Exception as e:
        logger.warning(f"DB horse stats error ({horse_name}): {e}")
        return {}


def get_jockey_db_stats(jockey_name: str, surface: str = "", distance: int = 0) -> dict:
    """DBから騎手の重賞成績統計を取得"""
    try:
        import sys, os
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        from db.database import get_connection

        conn = get_connection()
        results = conn.execute("""
            SELECT rr.rank, r.grade, r.surface, r.distance, r.venue
            FROM race_results rr
            JOIN races r ON rr.race_id = r.id
            WHERE rr.jockey_name = ?
            ORDER BY r.id DESC
            LIMIT 50
        """, (jockey_name,)).fetchall()

        conn.close()
        if not results:
            return {}

        total = len(results)
        wins  = sum(1 for r in results if r["rank"] == 1)
        top3  = sum(1 for r in results if r["rank"] and r["rank"] <= 3)

        # G1成績
        g1_results = [r for r in results if r["grade"] == "GⅠ"]
        g1_wins    = sum(1 for r in g1_results if r["rank"] == 1)

        # 同距離±200m
        dist_results = [r for r in results
                       if distance and r["distance"] and abs(r["distance"] - distance) <= 200]

        return {
            "total_races":    total,
            "wins":           wins,
            "top3":           top3,
            "win_rate":       f"{wins/total*100:.0f}%" if total else "0%",
            "g1_record":      f"{g1_wins}勝/{len(g1_results)}戦",
            "dist_record":    f"{sum(1 for r in dist_results if r['rank']==1)}勝/{len(dist_results)}戦" if dist_results else "実績なし",
        }
    except Exception as e:
        logger.warning(f"DB jockey stats error ({jockey_name}): {e}")
        return {}


# =============================================
# プロンプト生成（DB情報付き）
# =============================================

def build_race_prompt(race_info: dict) -> str:
    """レース情報＋DB統計からGemini用プロンプトを生成"""
    horses    = race_info.get("horses", [])
    surface   = race_info.get("surface", "")
    distance  = race_info.get("distance", 0)

    horse_lines = []
    for h in horses:
        name         = h.get("horse_name", "")
        jockey_name  = h.get("jockey_name", "")

        # DB統計を取得
        horse_stats  = get_horse_db_stats(name, surface, distance)
        jockey_stats = get_jockey_db_stats(jockey_name, surface, distance)

        # 馬の情報行
        line = f"■ 馬番{h['horse_no']} [{h.get('popular','')}番人気 {h.get('odds','')}倍] {name} ({h.get('age_sex','')})"

        if horse_stats:
            line += (
                f"\n   重賞成績: {horse_stats['total_races']}戦{horse_stats['wins']}勝"
                f"（勝率{horse_stats['win_rate']} 3着内率{horse_stats['top3_rate']}）"
                f" / {surface}成績:{horse_stats['surface_record']}"
                f" / 距離近似:{horse_stats['dist_record']}"
            )
            if horse_stats.get("recent3"):
                line += f"\n   直近3走: {' → '.join(horse_stats['recent3'])}"
        else:
            line += "\n   重賞成績: DBデータなし（初重賞出走の可能性）"

        # 騎手情報行
        line += f"\n   騎手: {jockey_name}"
        if jockey_stats:
            line += (
                f"（重賞{jockey_stats['total_races']}戦{jockey_stats['wins']}勝"
                f" 勝率{jockey_stats['win_rate']}"
                f" GⅠ:{jockey_stats['g1_record']}"
                f" 距離近似:{jockey_stats['dist_record']}）"
            )

        horse_lines.append(line)

    horses_text = "\n\n".join(horse_lines)

    prompt = f"""あなたは20年以上のキャリアを持つ競馬アナリストです。
以下のレース情報とJRA公式データに基づく各馬・騎手の重賞実績を分析し、予想を行ってください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【レース情報】
レース名  : {race_info.get('race_name', '')}
開催場    : {race_info.get('venue_name', '')}
条件      : {race_info.get('race_conditions', '')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【出走馬・実績データ（JRA公式2022-2026年重賞成績より）】
{horses_text}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【分析のポイント】
- 重賞実績がある馬を重視（特に同距離・同馬場での実績）
- 騎手の重賞勝率・GⅠ経験も考慮
- DBデータなしの馬は未知数として扱う
- 人気と実力のギャップ（穴馬）にも注目

以下の形式でJSONのみ返してください（前置き・後書き・```不要）:
{{
  "summary": "レース全体の展開予想と注目ポイント（300字以内）",
  "top3": [
    {{"rank": 1, "horse_no": "X", "horse_name": "馬名", "reason": "DB実績を踏まえた理由（100字以内）"}},
    {{"rank": 2, "horse_no": "X", "horse_name": "馬名", "reason": "DB実績を踏まえた理由（100字以内）"}},
    {{"rank": 3, "horse_no": "X", "horse_name": "馬名", "reason": "DB実績を踏まえた理由（100字以内）"}}
  ],
  "dark_horse": {{
    "horse_no": "X",
    "horse_name": "馬名",
    "reason": "穴馬として注目する理由（80字以内）"
  }},
  "recommended_bet": {{
    "type": "推奨買い目（例: 三連複BOX・馬連流し等）",
    "combination": "具体的な買い目",
    "reason": "推奨理由（100字以内）"
  }},
  "confidence": "高/中/低",
  "caution": "注意点（DBデータの限界・免責事項）"
}}"""
    return prompt


# =============================================
# メイン予想関数
# =============================================

async def get_ai_prediction(race_info: dict) -> Optional[dict]:
    """Gemini APIを使って競馬予想を取得（DB強化版）"""
    try:
        setup_gemini()
        model = genai.GenerativeModel("gemini-2.5-flash")  # 精度重視でflash使用

        # race_infoにsurface/distanceがなければ条件文字列から抽出
        if not race_info.get("surface") or not race_info.get("distance"):
            conditions = race_info.get("race_conditions", "")
            import re
            if "芝" in conditions:
                race_info["surface"] = "芝"
            elif "ダート" in conditions:
                race_info["surface"] = "ダート"
            m = re.search(r"(\d{4})", conditions)
            if m:
                race_info["distance"] = int(m.group(1))

        prompt = build_race_prompt(race_info)
        logger.info(f"Gemini予想リクエスト: {race_info.get('race_name','')}")

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.4,   # 低めにして一貫性重視
                max_output_tokens=2048,
            )
        )

        text = response.text.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        result = json.loads(text)

        # DB連携フラグを追加
        result["db_enhanced"] = True
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Gemini JSON parse error: {e}")
        return {"error": "AI予想の解析に失敗しました", "raw": text if 'text' in locals() else ""}
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return {"error": str(e)}
