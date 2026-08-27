"""나무위키 '일본의 상용한자/목록' 페이지에서 한국 한자음 / 일본어 예시단어 /
한자능력검정시험 급수를 파싱해 로컬 JSON으로 저장한다 (kanjiapi.dev 데이터의 보강용).
"""
import json
import os
import re

from bs4 import BeautifulSoup

HERE = os.path.dirname(os.path.abspath(__file__))
HTML_PATH = os.path.join(HERE, "..", "data_cache", "namu_joyo_list.html")
OUT_PATH = os.path.join(HERE, "..", "data_cache", "namu_enrich.json")

HIRAGANA = re.compile(r"[぀-ゟ]")
KATAKANA = re.compile(r"[゠-ヿ]")
FOOTNOTE_REF = re.compile(r"\[\d+\]")


def clean(text):
    return FOOTNOTE_REF.sub("", text).strip()


def cell_lines(td):
    text = td.get_text(separator="\n")
    return [line.strip() for line in text.split("\n") if line.strip()]


def main():
    with open(HTML_PATH, encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    tables = soup.find_all("table")
    result = {}
    skipped_rows = 0
    parsed_rows = 0

    for table in tables:
        rows = table.find_all("tr")
        if not rows:
            continue
        # 이 표가 대상 표인지 헤더로 판별
        header_cells = [c.get_text(strip=True) for c in rows[0].find_all("td")]
        if "신자체" not in header_cells or "음(한국)" not in header_cells:
            continue

        for row in rows:
            cells = row.find_all("td")
            if len(cells) != 7:
                continue
            first_text = cells[0].get_text(strip=True)
            if first_text == "순서" or not first_text.isdigit():
                continue  # 반복되는 헤더 행

            kanji_cell = cells[1]
            kanji_span = kanji_cell.find("span", attrs={"lang": "ja"})
            kanji = kanji_span.get_text(strip=True) if kanji_span else kanji_cell.get_text(strip=True)
            if not kanji:
                skipped_rows += 1
                continue

            old_form = clean(cells[2].get_text(strip=True))
            kr_reading = clean(cells[3].get_text(strip=True))
            jp_readings = cell_lines(cells[4])
            examples = cell_lines(cells[5])
            grade_cell = clean(cells[6].get_text(strip=True))

            on_readings = [r for r in jp_readings if KATAKANA.search(r)]
            kun_readings = [r for r in jp_readings if HIRAGANA.search(r)]

            if kanji in result:
                continue  # 중복 행은 첫 값 유지

            result[kanji] = {
                "old_form": old_form,
                "kr_reading": kr_reading,
                "on_readings_namu": on_readings,
                "kun_readings_namu": kun_readings,
                "examples": examples,
                "kanji_cert_grade": grade_cell,
            }
            parsed_rows += 1

    print(f"파싱된 한자 수: {parsed_rows}, 스킵된 행: {skipped_rows}")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"저장 위치: {OUT_PATH}")


if __name__ == "__main__":
    main()
