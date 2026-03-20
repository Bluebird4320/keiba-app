"""
Gemini API 連携 - 競馬予想AI
"""

import google.generativeai as genai
import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def setup_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY が設定されていません")
    genai.configure(api_key=api_key)


def build_race_prompt(race_info: dict) -> str:
    """レース情報からGemini用プロンプトを生成"""
    horses = race_info.get("horses", [])
    horse_lines = []
    for h in horses:
        past = h.get("past_races", [])
        past_str = ", ".join(
            [f"{r['race_name']}({r['rank']}着)" for r in past[:5]]
        ) if past else "データなし"
        horse_lines.append(
            f"- 馬番{h['horse_no']} {h['horse_name']} "
            f"({h.get('age_sex','')} 騎手:{h.get('jockey_name','')} "
            f"オッズ:{h.get('odds','')}倍) "
            f"過去成績: {past_str}"
        )

    horses_text = "\n".join(horse_lines)

    prompt = f"""あなたはベテランの競馬アナリストです。以下のレース情報を分析して予想を行ってください。

【レース情報】
レース名: {race_info.get('race_name', '')}
開催条件: {race_info.get('race_conditions', '')}
開催場: {race_info.get('venue_name', '')}

【出走馬一覧】
{horses_text}

以下の形式でJSONのみ返してください（前置き・後書き不要）:
{{
  "summary": "レース全体の展開予想（200字以内）",
  "top3": [
    {{"rank": 1, "horse_no": "X", "horse_name": "馬名", "reason": "理由（80字以内）"}},
    {{"rank": 2, "horse_no": "X", "horse_name": "馬名", "reason": "理由（80字以内）"}},
    {{"rank": 3, "horse_no": "X", "horse_name": "馬名", "reason": "理由（80字以内）"}}
  ],
  "recommended_bet": {{
    "type": "推奨買い目（例: 三連複BOX）",
    "combination": "買い目の組み合わせ",
    "reason": "推奨理由（100字以内）"
  }},
  "caution": "注意点・免責事項"
}}"""
    return prompt


async def get_ai_prediction(race_info: dict) -> Optional[dict]:
    """Gemini APIを使って競馬予想を取得"""
    try:
        setup_gemini()
        model = genai.GenerativeModel("gemini-2.5-flash-lite")
        prompt = build_race_prompt(race_info)

        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=1024,
            )
        )

        text = response.text.strip()
        # JSONフェンスを除去
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)

    except json.JSONDecodeError as e:
        logger.error(f"Gemini JSON parse error: {e}")
        return {"error": "AI予想の解析に失敗しました", "raw": text if 'text' in locals() else ""}
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        return {"error": str(e)}
