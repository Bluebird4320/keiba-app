"""
定期スクレイピングスケジューラー
毎週金曜22:00に当年の重賞データを自動更新する
実行: python scheduler.py
"""

import schedule
import time
import logging
from datetime import datetime
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scraper.jra_scraper import scrape_year

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("/Volumes/SSD001/Dev/keiba-app/backend/db/scraper.log"),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger(__name__)


def job():
    year = datetime.now().year
    logger.info(f"定期スクレイピング開始: {year}年")
    try:
        scrape_year(year)
        logger.info("定期スクレイピング完了")
    except Exception as e:
        logger.error(f"定期スクレイピングエラー: {e}")


# 毎週金曜22:00に実行
schedule.every().friday.at("22:00").do(job)
# 毎週土曜22:00にも実行（当日レース結果を取得）
schedule.every().saturday.at("22:00").do(job)
schedule.every().sunday.at("22:00").do(job)

if __name__ == "__main__":
    logger.info("スケジューラー起動")
    logger.info("実行予定: 毎週 金・土・日 22:00")
    logger.info("Ctrl+C で停止")

    # 起動時に即実行したい場合はコメントを外す
    # job()

    while True:
        schedule.run_pending()
        time.sleep(60)
