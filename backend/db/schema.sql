-- 重賞レース一覧
CREATE TABLE IF NOT EXISTS races (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    race_url    TEXT UNIQUE NOT NULL,        -- /datafile/seiseki/replay/2026/001.html
    year        INTEGER NOT NULL,
    race_date   TEXT,                        -- "1月4日"
    race_name   TEXT NOT NULL,              -- "中山金杯"
    venue       TEXT,                        -- "中山"
    grade       TEXT,                        -- "GⅢ"
    sex_age     TEXT,                        -- "4歳以上"
    surface     TEXT,                        -- "芝"
    distance    INTEGER,                     -- 2000
    winner_name TEXT,                        -- "カラマティアノス"
    winner_jockey TEXT,                      -- "津村 明秀"
    lap_time    TEXT,                        -- ハロンタイム
    last_3f     TEXT,                        -- 上り3F
    scraped_at  TEXT DEFAULT (datetime('now', 'localtime'))
);

-- レース着順結果（各馬の成績）
CREATE TABLE IF NOT EXISTS race_results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id         INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    rank            INTEGER,                 -- 着順
    bracket_no      INTEGER,                 -- 枠番
    horse_no        INTEGER,                 -- 馬番
    horse_name      TEXT NOT NULL,           -- 馬名
    sex_age         TEXT,                    -- 性齢 "牡4"
    burden_weight   REAL,                    -- 負担重量 55.0
    jockey_name     TEXT,                    -- 騎手名
    finish_time     TEXT,                    -- タイム "2:00.3"
    margin          TEXT,                    -- 着差 "ハナ"
    last_3f         REAL,                    -- 上り3F 34.4
    horse_weight    INTEGER,                 -- 馬体重 478
    weight_diff     INTEGER,                 -- 増減 +2
    trainer_name    TEXT,                    -- 調教師名
    win_odds        REAL,                    -- 単勝オッズ
    popular         INTEGER,                 -- 人気
    corner_order    TEXT,                    -- コーナー通過順位
    scraped_at      TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 騎手マスター
CREATE TABLE IF NOT EXISTS jockeys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    wins_year   INTEGER DEFAULT 0,          -- 今年勝利数
    updated_at  TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 馬マスター（過去成績から自動生成）
CREATE TABLE IF NOT EXISTS horses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    sex         TEXT,                        -- 牡/牝/せん
    updated_at  TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(name, sex)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_results_race   ON race_results(race_id);
CREATE INDEX IF NOT EXISTS idx_results_horse  ON race_results(horse_name);
CREATE INDEX IF NOT EXISTS idx_results_jockey ON race_results(jockey_name);
CREATE INDEX IF NOT EXISTS idx_races_year     ON races(year);
CREATE INDEX IF NOT EXISTS idx_races_name     ON races(race_name);
