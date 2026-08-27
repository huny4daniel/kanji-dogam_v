"""한국어문회 등급별 선정한자 데이터셋(rycont/hanja-grade-dataset)을 받아
한자 훈(訓, 뜻) 조회용 로컬 캐시로 저장한다.
출처: https://github.com/rycont/hanja-grade-dataset (원 저작권은 한국어문회)
"""
import os

import requests

URL = "https://raw.githubusercontent.com/rycont/hanja-grade-dataset/main/hanja.csv"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(HERE, "..", "data_cache", "hanja_grade.csv")


def main():
    resp = requests.get(URL, timeout=30)
    resp.raise_for_status()
    with open(OUT_PATH, "wb") as f:
        f.write(resp.content)
    print(f"저장 완료: {OUT_PATH} ({len(resp.content)} bytes)")


if __name__ == "__main__":
    main()
