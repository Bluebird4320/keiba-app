# 🏇 競馬 AI 予想アプリ

JRAレース情報をリアルタイムで取得し、Gemini AIが予想を行う競馬Webアプリです。

## 機能一覧

| 機能 | 説明 |
|------|------|
| レース一覧 | 当日・翌日のJRA全開催レースを開催場ごとに表示 |
| 出走馬情報 | 馬番・枠番・騎手・馬体重・調教師など基本情報 |
| 過去成績 | 各馬の直近10走のレース名と着順を表示 |
| 騎手情報 | 騎乗騎手のプロフィールと成績 |
| リアルタイムオッズ | 単勝・複勝・馬連・馬単・ワイド・三連複・三連単 |
| 買い目シミュレーター | 全勝式対応・BOX・マルチ・金額計算 |
| AI予想 | Gemini 2.5 Flash によるレース展開・推奨買い目 |

## 技術スタック

- **フロントエンド**: React + Vite
- **バックエンド**: Python FastAPI
- **データ取得**: netkeiba スクレイピング
- **AI**: Google Gemini API (gemini-2.5-flash-lite)

## セットアップ

### 1. Gemini APIキーを取得
[Google AI Studio](https://aistudio.google.com/) でAPIキーを発行します。

### 2. バックエンドのセットアップ

```bash
cd backend

# 仮想環境（任意）
python -m venv venv && source venv/bin/activate

# 依存パッケージのインストール
pip install -r requirements.txt

# .envファイルの作成
cp .env.example .env
# .env を開いて GEMINI_API_KEY に取得したキーを設定

# 起動
uvicorn main:app --reload
```

バックエンドが起動すると http://localhost:8000 で動作します。  
APIドキュメントは http://localhost:8000/docs で確認できます。

### 3. フロントエンドのセットアップ

```bash
cd frontend
npm install
npm run dev
```

http://localhost:5173 でアプリが起動します。

## 注意事項

- netkeiba のスクレイピングはサーバー負荷を抑えるため1秒間隔でリクエストしています
- レース詳細（出走馬全頭の過去成績取得）は初回1〜2分かかる場合があります
- オッズはレース発走前のみ取得可能です
- AI予想は参考情報です。馬券購入は自己責任でお願いします

## ディレクトリ構成

```
keiba-app/
├── backend/
│   ├── main.py                  # FastAPI エントリポイント
│   ├── requirements.txt
│   ├── .env.example
│   ├── scraper/
│   │   └── netkeiba_scraper.py  # データ取得
│   └── api/
│       └── gemini_predictor.py  # AI予想
└── frontend/
    ├── src/
    │   ├── components/          # UIコンポーネント
    │   ├── pages/               # ページコンポーネント
    │   ├── services/api.js      # API通信
    │   └── styles/global.css
    └── vite.config.js
```
