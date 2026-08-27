"""kanjiapi.dev에서 조요칸지 상세 정보를 받아 로컬 캐시(JSON 파일)에 저장한다.
재실행 시 이미 받은 문자는 건너뛴다 (idempotent).
"""
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

BASE = "https://kanjiapi.dev/v1/kanji"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, "..", "data_cache", "kanjiapi")
LIST_PATH = os.path.join(HERE, "..", "data_cache", "joyo_list.json")

os.makedirs(CACHE_DIR, exist_ok=True)


def fetch_joyo_list():
    if os.path.exists(LIST_PATH):
        with open(LIST_PATH, encoding="utf-8") as f:
            return json.load(f)
    resp = requests.get(f"{BASE}/joyo", timeout=20)
    resp.raise_for_status()
    data = resp.json()
    with open(LIST_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def cache_path(char):
    return os.path.join(CACHE_DIR, f"{ord(char):05x}.json")


def fetch_one(char):
    path = cache_path(char)
    if os.path.exists(path):
        return char, "cached"
    url = f"{BASE}/{char}"
    resp = requests.get(url, timeout=20)
    if resp.status_code != 200:
        return char, f"error:{resp.status_code}"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(resp.json(), f, ensure_ascii=False, indent=2)
    return char, "fetched"


def main():
    chars = fetch_joyo_list()
    print(f"joyo list: {len(chars)}자")

    todo = [c for c in chars if not os.path.exists(cache_path(c))]
    print(f"신규 요청 필요: {len(todo)}자")

    fetched = 0
    errors = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_one, c): c for c in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            char, status = fut.result()
            if status.startswith("error"):
                errors.append((char, status))
            elif status == "fetched":
                fetched += 1
            if i % 100 == 0:
                print(f"  진행: {i}/{len(todo)}")

    print(f"완료: 신규 {fetched}자 수신, 오류 {len(errors)}건")
    for char, status in errors:
        print(f"  오류 {char}: {status}")


if __name__ == "__main__":
    main()
