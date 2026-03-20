"""
競馬予想アプリ - FastAPI バックエンド
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scraper.netkeiba_scraper import (
    get_race_list_by_date,
    get_race_detail,
    get_horse_past_races,
    get_jockey_info,
    get_odds,
    get_today_and_tomorrow,
    VENUE_CODES,
)
from api.gemini_predictor import get_ai_prediction

app = FastAPI(
    title="競馬予想API",
    description="JRAレース情報・AI予想・オッズ取得API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "message": "競馬予想API is running"}


@app.get("/api/races")
async def get_races(
    date: Optional[str] = Query(None, description="日付 YYYYMMDD (省略時は今日・明日両方)"),
):
    """
    指定日のレース一覧を開催場ごとにグループ化して返す
    """
    if date:
        dates = [date]
    else:
        today, tomorrow = get_today_and_tomorrow()
        dates = [today, tomorrow]

    all_data = {}
    for d in dates:
        races = await get_race_list_by_date(d)
        # 開催場でグループ化
        venues = {}
        for race in races:
            vname = race["venue_name"]
            if vname not in venues:
                venues[vname] = []
            venues[vname].append(race)
        all_data[d] = venues

    return {"dates": all_data}


@app.get("/api/race/{race_id}")
async def get_race(race_id: str):
    """
    レース詳細（出走馬・騎手・過去成績）を取得
    """
    race = await get_race_detail(race_id)
    if not race:
        raise HTTPException(status_code=404, detail="レース情報が取得できませんでした")

    # 馬の過去成績・騎手情報を並列取得
    async def enrich_horse(horse: dict) -> dict:
        tasks = []
        if horse.get("horse_id"):
            tasks.append(get_horse_past_races(horse["horse_id"]))
        else:
            tasks.append(asyncio.coroutine(lambda: [])())

        if horse.get("jockey_id"):
            tasks.append(get_jockey_info(horse["jockey_id"]))
        else:
            tasks.append(asyncio.coroutine(lambda: {})())

        past_races, jockey_info = await asyncio.gather(*tasks)
        horse["past_races"] = past_races
        horse["jockey_info"] = jockey_info
        return horse

    # 馬を並列エンリッチ（最大5並列）
    sem = asyncio.Semaphore(3)
    async def enrich_with_sem(horse):
        async with sem:
            return await enrich_horse(horse)

    race["horses"] = await asyncio.gather(*[enrich_with_sem(h) for h in race["horses"]])
    return race


@app.get("/api/race/{race_id}/odds")
async def get_race_odds(race_id: str):
    """
    リアルタイムオッズを全勝式取得
    """
    odds = await get_odds(race_id)
    return {"race_id": race_id, "odds": odds}


@app.get("/api/race/{race_id}/predict")
async def predict_race(race_id: str):
    """
    Gemini AIによる予想を取得
    """
    race = await get_race_detail(race_id)
    if not race:
        raise HTTPException(status_code=404, detail="レース情報が取得できませんでした")

    # 過去成績を取得（予想用に簡易版）
    async def get_past(horse):
        if horse.get("horse_id"):
            horse["past_races"] = await get_horse_past_races(horse["horse_id"], limit=5)
        return horse

    sem = asyncio.Semaphore(3)
    async def get_past_sem(horse):
        async with sem:
            return await get_past(horse)

    race["horses"] = await asyncio.gather(*[get_past_sem(h) for h in race["horses"]])
    prediction = await get_ai_prediction(race)
    return {"race_id": race_id, "prediction": prediction}


@app.get("/api/horse/{horse_id}/history")
async def get_horse_history(horse_id: str, limit: int = 10):
    """馬の過去成績を取得"""
    results = await get_horse_past_races(horse_id, limit)
    return {"horse_id": horse_id, "results": results}


@app.get("/api/jockey/{jockey_id}")
async def get_jockey(jockey_id: str):
    """騎手情報を取得"""
    info = await get_jockey_info(jockey_id)
    return {"jockey_id": jockey_id, "info": info}


# 買い目計算エンドポイント
class BetSimulationRequest(BaseModel):
    bet_type: str        # win / place / quinella / exacta / wide / trio / trifecta
    horses: list[str]    # 馬番リスト
    amount_per_bet: int  # 1点あたり金額（100円単位）
    multi: bool = False  # マルチ
    box: bool = False    # ボックス


class BetSimulationResponse(BaseModel):
    bet_type: str
    combinations: list[dict]
    total_bets: int
    total_amount: int


def generate_combinations(bet_type: str, horses: list[str], box: bool, multi: bool) -> list[list[str]]:
    """買い目組み合わせを生成"""
    from itertools import combinations, permutations

    h = horses
    combos = []

    if bet_type == "win":
        combos = [[x] for x in h]

    elif bet_type == "place":
        combos = [[x] for x in h]

    elif bet_type == "quinella":  # 馬連
        combos = [list(c) for c in combinations(h, 2)]

    elif bet_type == "exacta":    # 馬単
        if box:
            combos = [list(p) for p in permutations(h, 2)]
        else:
            combos = [list(p) for p in permutations(h, 2)]

    elif bet_type == "wide":      # ワイド
        combos = [list(c) for c in combinations(h, 2)]

    elif bet_type == "trio":      # 三連複
        combos = [list(c) for c in combinations(h, 3)]

    elif bet_type == "trifecta":  # 三連単
        if box:
            combos = [list(p) for p in permutations(h, 3)]
        elif multi:
            # 軸1頭マルチ: 先頭固定、残り順不同
            if len(h) >= 3:
                axis = h[0]
                rest = h[1:]
                for c in combinations(rest, 2):
                    for p in permutations([axis] + list(c)):
                        combos.append(list(p))
        else:
            combos = [list(p) for p in permutations(h, 3)]

    elif bet_type == "quinella_place":  # 馬連流し相当
        combos = [list(c) for c in combinations(h, 2)]

    return combos


@app.post("/api/simulate", response_model=BetSimulationResponse)
def simulate_bet(req: BetSimulationRequest):
    """買い目・金額シミュレーション"""
    amount = max(100, (req.amount_per_bet // 100) * 100)
    combos = generate_combinations(req.bet_type, req.horses, req.box, req.multi)

    combo_list = [
        {"combination": "-".join(c), "amount": amount}
        for c in combos
    ]

    return BetSimulationResponse(
        bet_type=req.bet_type,
        combinations=combo_list,
        total_bets=len(combo_list),
        total_amount=len(combo_list) * amount,
    )
