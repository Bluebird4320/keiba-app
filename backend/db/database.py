"""
SQLite DB接続・初期化モジュール
DBファイルは /Volumes/SSD001/Dev/keiba-app/backend/db/keiba.db
"""

import sqlite3
import os
from pathlib import Path

DB_PATH = Path(__file__).parent / "keiba.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def get_connection() -> sqlite3.Connection:
    """DB接続を返す（Row factoryあり）"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # 並行アクセス対応
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """スキーマを適用してDBを初期化"""
    conn = get_connection()
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()
    print(f"DB初期化完了: {DB_PATH}")


def get_stats() -> dict:
    """DB統計情報を返す"""
    conn = get_connection()
    stats = {}
    for table in ["races", "race_results", "jockeys", "horses"]:
        row = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}").fetchone()
        stats[table] = row["cnt"]
    conn.close()
    return stats


if __name__ == "__main__":
    init_db()
    print("Stats:", get_stats())
