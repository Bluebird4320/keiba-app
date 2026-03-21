# 競馬AI予想アプリ - 開発ガイドライン

## プロジェクト概要
JRAレース情報をリアルタイムで取得し、Gemini AIが予想を行う競馬Webアプリ。
- 場所: /Volumes/SSD001/Dev/keiba-app/
- GitHub: https://github.com/Bluebird4320/keiba-app
- Python環境: conda activate ai

## 重要ルール
- ファイル修正は必ずClaude Codeで直接編集（ZIPでの配置はミスが多発するため禁止）
- ポート競合時: lsof -ti:8000 | xargs kill -9 2>/dev/null
- キャッシュ問題時: find backend -name "__pycache__" -type d -exec rm -rf {} +

## 起動方法
バックエンド: conda activate ai && cd backend && uvicorn main:app --reload
フロントエンド: cd frontend && npm run dev

## 技術スタック
- フロントエンド: React + Vite (port 5173)
- バックエンド: Python FastAPI (port 8000)
- DB: SQLite (backend/db/keiba.db) 2022-2026年重賞482件
- データ取得: keibalab.jp スクレイピング（無料）
- AI予想: Gemini API (gemini-2.5-flash)

## ディレクトリ構成
backend/main.py                   # FastAPI エントリポイント
backend/api/gemini_predictor.py   # Gemini AI予想（DB実績データ連携）
backend/db/database.py            # SQLite接続
backend/db/keiba.db               # DBデータ本体（Gitignore済み）
backend/scraper/netkeiba_scraper.py  # ★メインスクレイパー（keibalab）
backend/scraper/jra_scraper.py    # JRA公式重賞データ取得・DB保存
backend/scraper/scheduler.py      # 毎週自動更新スケジューラー
frontend/src/components/HorseCard.jsx    # 出走馬カード（過去成績）
frontend/src/components/BetSimulator.jsx # 買い目シミュレーター
frontend/src/components/AIPrediction.jsx # AI予想表示
frontend/src/components/OddsPanel.jsx    # オッズ表示
frontend/src/pages/RaceListPage.jsx      # レース一覧（昨日・今日・明日）
frontend/src/pages/RaceDetailPage.jsx   # レース詳細

## データ取得の仕組み
メインデータソース: keibalab.jp（無料）
- レース一覧: keibalab.jp/db/race/YYYYMMDD/
- 出走馬詳細: keibalab.jp/db/race/YYYYMMDDVVRR/
- 重賞結果: jra.go.jp/datafile/seiseki/replay/YYYY/NNN.html

race_id形式: 202603220611
  2026 03 22 06 11
  年月日 場コード レース番号

開催場コード:
  06=中山 09=阪神 07=中京 05=東京 08=京都
  01=札幌 02=函館 03=福島 04=新潟 10=小倉

## megamoriTableの構造（keibalab出走馬ページ）
列順序: 右→左（高馬番→低馬番）
末尾の枠番行（行658付近）を使う
行0: 枠番 / 行1: 馬番 / 行5: 性齢 / 行6: 単勝オッズ(人気)
行8: 斤量 / 行10: 騎手 / 行11: 厩舎
行261〜: 1走前〜5走前（各馬8行1セット）

過去走8行の構造:
  行0: "5東京811/30芝16晴良4" → 開催場・日付・芝ダ・距離・天候・馬場・着順
  行1: レース名
  行2: "2人1:34.034.7S" → 人気・タイム
  行3: 馬体重
  行4: コーナー通過
  行5: 頭数・馬番
  行6: "ルメール55.0" → 騎手・斤量
  行7: "ﾄﾞﾘｰﾑｺ(0.9)" → 着差・1着馬

## 既知の制約
- 複合オッズ（馬連・三連複等）は取得不可（bot対策で403）
- 単勝・複勝・枠連のみ実データ取得可能
- JRA-VAN DataLabはWindows専用のためMac・ラズパイでは使用不可
- リクエスト間隔は0.8秒（サーバー負荷対策）

## APIエンドポイント
GET  /api/races?date=YYYYMMDD     # レース一覧
GET  /api/race/{race_id}          # レース詳細（出走馬・過去成績）
GET  /api/race/{race_id}/odds     # オッズ（単勝・複勝・枠連）
GET  /api/race/{race_id}/predict  # AI予想
POST /api/simulate                # 買い目シミュレーション
GET  /api/db/stats                # DB統計

## 今後の課題
🔴 前日レース詳細取得の安定化（終了済みレースのページ構造対応）
🔴 タブ切り替え時のちらつき修正
🟡 複合オッズ（JRDB契約で解決可・月2,380円）
🟡 毎週自動更新スケジューラー常駐化
🟡 ラズパイへのサーバー移行（24時間稼働）
🟢 重賞DB過去年追加（2020-2021年）

## Git運用
git add -A
git commit -m "feat/fix: 変更内容"
git push

# ._ファイル混入時
echo '._*' >> .gitignore
git rm -r --cached '._*' 2>/dev/null; true
git add .gitignore && git commit -m "chore: macOSメタデータ除外"
