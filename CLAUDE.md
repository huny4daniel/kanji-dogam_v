# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

일본 상용한자(조요칸지) 2136자를 학습하기 위한 정적 웹 앱. 그리드로 한자를 훑어보고, 클릭하면 획수/JLPT 급수/음훈독/한국 한자음/한자검정 급수/예시 단어를 보여주며, 퀴즈 모드로 훈음을 직접 입력해 암기 여부를 테스트한다.

빌드 도구나 서버 없이 브라우저에서 바로 동작하는 순수 HTML/CSS/JS 앱이다.

## 실행 방법

```bash
# index.html을 브라우저로 직접 열면 된다 (별도 서버 불필요)
```

## 코드 구조

**정적 파일 4개로 구성**:
- `index.html` — 그리드, 상세 모달, 퀴즈 모달의 DOM 구조
- `style.css` — 전체 스타일
- `data.js` — 한자 데이터 배열(`KANJI_DATA`). **자동 생성 파일이므로 직접 수정하지 않는다.**
- `app.js` — 렌더링, 정렬/필터/검색, 학습 상태 토글, 퀴즈 로직

### 상태 저장

`localStorage`에 두 키로 저장한다 (서버/DB 없음):
- `joyo-kanji-learned` — 외운 한자 목록 (배열을 JSON으로)
- `joyo-kanji-quick-check` — 빠른 체크 모드 on/off

URL 해시로 특정 한자를 일괄 학습 해제할 수 있다: `index.html#unlearn=書,豆,玉`

### 주요 기능 (app.js)

- **정렬/필터/검색**: 학년별·획수순·JLPT순·한자급수순·가나다순 정렬, 학습 여부 필터, 한자/읽기 검색 (`buildGroups`, `matchesSearch`, `matchesFilter`)
- **퀴즈 모드**: 그룹별 / 전체(모르는 것 우선) / 아는 것 중에서 세 가지 범위로 출제. 훈음을 텍스트로 입력받아 채점 (`startQuiz`, `showQuizQuestion`, `resolveQuizAnswer`)

## 데이터 파이프라인 (scripts/)

`data.js`는 아래 스크립트를 순서대로 실행해 재생성한다. 원본 데이터는 `data_cache/`에 캐시되며 (git에는 포함하지 않음), 재실행 시 이미 받은 항목은 건너뛴다.

1. `fetch_kanjiapi.py` — kanjiapi.dev에서 조요칸지 상세(획수/JLPT/음훈독)를 받아 `data_cache/kanjiapi/*.json`에 캐시
2. `fetch_hanja_grade.py` — 한국어문회 등급별 선정한자 데이터셋(외부 GitHub 저장소)을 받아 `data_cache/hanja_grade.csv`에 저장 (훈 조회용)
3. `parse_namu.py` — 나무위키 '일본의 상용한자/목록' 페이지(`data_cache/namu_joyo_list.html`, 수동으로 저장해둬야 함)를 파싱해 한국 한자음/예시단어/한자검정 급수를 `data_cache/namu_enrich.json`에 저장
4. `merge_data.py` — 위 세 소스를 병합해 `data.js`를 생성. 기준 한자 집합은 나무위키 쪽 2136자(공식 상용한자표와 일치 확인됨)를 채택

```bash
pip install requests beautifulsoup4
python scripts/fetch_kanjiapi.py
python scripts/fetch_hanja_grade.py
# namu_joyo_list.html은 수동으로 data_cache/에 저장해야 함
python scripts/parse_namu.py
python scripts/merge_data.py
```

## 버전 관리 방식

파일명은 고정하고, 버전은 git 태그(`vX.Y.Z`)로만 관리한다.

## 빌드 / 배포

GitHub Actions (`.github/workflows/release.yml`):
- 태그(`v*`) push 시 정적 파일(`index.html`, `app.js`, `data.js`, `style.css`)을 zip으로 압축해 릴리즈에 첨부
- 같은 major.minor 버전의 기존 릴리즈는 자동 삭제 후 새 릴리즈 생성

## 커밋 규칙

### 커밋 전 필수 작업
1. **git 태그**: 커밋 후 새 버전으로 태그 생성 (`git tag vX.Y.Z`)

### 커밋 메시지
- **한국어**, 한 줄 요약
- **기술적 변경 사항만** 기술 (한자 데이터 내용, 수치 조정 등은 제외)
- `Co-Authored-By:`, `Claude-Session:` 등 AI 흔적 일절 포함 금지
- prefix(feat:, fix: 등) 없이 내용만 작성

### 버전 체계
- `vMAJOR.MINOR.PATCH` 형식
- MAJOR: 아키텍처/호환성 깨지는 변경
- MINOR: 신규 기능 추가
- PATCH: 버그 수정 / 소규모 개선
