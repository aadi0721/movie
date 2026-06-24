import os
from huey import SqliteHuey

# Use a sqlite database for the task queue to avoid needing Redis
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "huey.db")

huey = SqliteHuey(filename=db_path)

@huey.task()
def run_spider_task(max_pages: int = 0):
    from scheduler import run_spider
    run_spider(max_pages)
