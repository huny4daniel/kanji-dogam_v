"""kanjiapi.dev 캐시 + 나무위키 파싱 결과를 병합해 앱이 쓰는 data.js를 만든다.

기준 한자 집합: 나무위키에서 파싱한 2136자 (공식 상용한자표와 정확히 일치 확인됨).
kanjiapi.dev의 joyo 목록은 2140자인데, 4개 한자(剝/塡/頰/𠮟)에 대해
인쇄표준자체와 약자체 두 코드포인트를 모두 포함하고 있어 4자가 더 많다.
이 스크립트는 나무위키 쪽 코드포인트를 정규 표기로 채택하고, kanjiapi 조회 시에만
별칭 매핑으로 다른 코드포인트를 찾는다.
"""
import ast
import csv
import json
import os
import re
import unicodedata

TRAILING_REF = re.compile(r"\[[^\]]*\]$")

HERE = os.path.dirname(os.path.abspath(__file__))
KANJIAPI_DIR = os.path.join(HERE, "..", "data_cache", "kanjiapi")
NAMU_PATH = os.path.join(HERE, "..", "data_cache", "namu_enrich.json")
HANJA_GRADE_PATH = os.path.join(HERE, "..", "data_cache", "hanja_grade.csv")
OUT_PATH = os.path.join(HERE, "..", "data.js")


def norm(s):
    return unicodedata.normalize("NFKC", s)


def load_hun_map():
    """한국어문회 등급별 선정한자 데이터셋에서 한자 -> 훈(첫 뜻풀이) 매핑을 만든다.
    이 데이터셋은 신자체가 아닌 정자(번체)를 쓰므로, 병합 시 나무위키의 구자체 컬럼으로
    조회해야 한다. 일부 문자는 CJK 호환용 코드포인트로 실려 있어 NFKC로 정규화해 매칭한다.
    """
    hun_map = {}
    with open(HANJA_GRADE_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            meaning = ast.literal_eval(row["meaning"])
            hun = meaning[0][0][0]  # 첫 번째 뜻풀이 그룹의 첫 훈
            hun = TRAILING_REF.sub("", hun)  # "강할[強]" 같은 이체자 참조 표기 제거
            hun_map[norm(row["hanja"])] = hun
    return hun_map

# 나무위키 파싱 과정에서 툴팁 span을 잘못 집어 생긴 오탐 2건 수정
NAMU_KEY_FIXES = {
    "\U00025874": "稽",  # 𥡴 -> 稽
    "\U000041f3": "箋",  # 䇳 -> 箋
}

# 나무위키 코드포인트 -> kanjiapi.dev 코드포인트 별칭 (인쇄표준자체 4자)
KANJIAPI_ALIAS = {
    "剥": "剝",
    "填": "塡",
    "頬": "頰",
    "叱": "\U00020B9F",  # 叱 -> 𠮟
}


def load_kanjiapi(char):
    path = os.path.join(KANJIAPI_DIR, f"{ord(char):05x}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    with open(NAMU_PATH, encoding="utf-8") as f:
        namu = json.load(f)

    for bad_key, good_key in NAMU_KEY_FIXES.items():
        if bad_key in namu:
            namu[good_key] = namu.pop(bad_key)

    print(f"기준 한자 수: {len(namu)}")

    hun_map = load_hun_map()

    merged = []
    missing_kanjiapi = []
    missing_hun = []

    for bad_key, good_key in NAMU_KEY_FIXES.items():
        for enrich in namu.values():
            enrich["examples"] = [ex.replace(bad_key, good_key) for ex in enrich.get("examples", [])]

    for char, enrich in namu.items():
        detail = load_kanjiapi(char)
        if detail is None:
            alias = KANJIAPI_ALIAS.get(char)
            if alias:
                detail = load_kanjiapi(alias)
        if detail is None:
            missing_kanjiapi.append(char)
            detail = {}

        grade = detail.get("grade")
        grade_label = str(grade) if grade in (1, 2, 3, 4, 5, 6) else "middle"

        old_form = enrich.get("old_form", "")
        hun = hun_map.get(norm(old_form)) if old_form else None
        if hun is None:
            hun = hun_map.get(norm(char))
        if hun is None:
            missing_hun.append(char)

        merged.append({
            "kanji": char,
            "grade": grade_label,
            "strokes": detail.get("stroke_count"),
            "jlpt": detail.get("jlpt"),
            "on": detail.get("on_readings", []),
            "kun": detail.get("kun_readings", []),
            "meaning": ", ".join(detail.get("meanings", [])),
            "krReading": enrich.get("kr_reading", ""),
            "krHun": hun or "",
            "krExamples": enrich.get("examples", []),
            "krCertGrade": enrich.get("kanji_cert_grade", "").replace(" ", ""),
        })

    if missing_kanjiapi:
        print(f"kanjiapi 매칭 실패 {len(missing_kanjiapi)}자: {missing_kanjiapi}")
    else:
        print("전체 한자 kanjiapi 매칭 성공")

    if missing_hun:
        print(f"훈 매칭 실패 {len(missing_hun)}자 (일본 국자 등 한국 훈음이 없는 경우 포함): {missing_hun}")

    # 결측치 확인
    no_strokes = [m["kanji"] for m in merged if m["strokes"] is None]
    if no_strokes:
        print(f"획수 결측 {len(no_strokes)}자: {no_strokes}")

    merged.sort(key=lambda m: (m["grade"] if m["grade"] != "middle" else "9", m["kanji"]))

    js = "// 자동 생성 파일 (scripts/merge_data.py) - 직접 수정하지 말 것\n"
    js += "const KANJI_DATA = "
    js += json.dumps(merged, ensure_ascii=False, indent=1)
    js += ";\n"

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js)

    print(f"총 {len(merged)}자 -> {OUT_PATH}")


if __name__ == "__main__":
    main()
