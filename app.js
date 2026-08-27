const STORAGE_KEY = "joyo-kanji-learned";
const QUICK_CHECK_KEY = "joyo-kanji-quick-check";

const learned = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
let quickCheckMode = localStorage.getItem(QUICK_CHECK_KEY) === "1";

// URL 해시로 특정 한자를 일괄 학습 해제하는 부트스트랩 (예: index.html#unlearn=書,豆,玉)
if (location.hash.startsWith("#unlearn=")) {
  const list = decodeURIComponent(location.hash.slice("#unlearn=".length))
    .split(",")
    .filter(Boolean);
  for (const k of list) learned.delete(k);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...learned]));
  history.replaceState(null, "", location.pathname + location.search);
}

const gridEl = document.getElementById("grid");
const sortSelect = document.getElementById("sortSelect");
const filterSelect = document.getElementById("filterSelect");
const searchInput = document.getElementById("searchInput");
const quickCheckToggle = document.getElementById("quickCheckToggle");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalKanji = document.getElementById("modalKanji");
const learnedCheckbox = document.getElementById("learnedCheckbox");
const modalGrade = document.getElementById("modalGrade");
const modalStrokes = document.getElementById("modalStrokes");
const modalJlpt = document.getElementById("modalJlpt");
const modalReadings = document.getElementById("modalReadings");
const modalMeaning = document.getElementById("modalMeaning");
const modalKrReading = document.getElementById("modalKrReading");
const modalKrCert = document.getElementById("modalKrCert");
const modalExamples = document.getElementById("modalExamples");

let activeKanji = null;

const quizOpenBtn = document.getElementById("quizOpenBtn");
const quizOverlay = document.getElementById("quizOverlay");
const quizClose = document.getElementById("quizClose");
const quizSetupEl = document.getElementById("quizSetup");
const quizQuestionEl = document.getElementById("quizQuestion");
const quizDoneEl = document.getElementById("quizDone");
const quizGroupPicker = document.getElementById("quizGroupPicker");
const quizGroupDim = document.getElementById("quizGroupDim");
const quizGroupValue = document.getElementById("quizGroupValue");
const quizPoolInfo = document.getElementById("quizPoolInfo");
const quizStartBtn = document.getElementById("quizStart");
const quizProgressText = document.getElementById("quizProgressText");
const quizKanjiEl = document.getElementById("quizKanji");
const quizInput = document.getElementById("quizInput");
const quizSubmitBtn = document.getElementById("quizSubmit");
const quizDontKnowBtn = document.getElementById("quizDontKnow");
const quizNextBtn = document.getElementById("quizNext");
const quizFeedback = document.getElementById("quizFeedback");
const quizDoneText = document.getElementById("quizDoneText");
const quizWrongList = document.getElementById("quizWrongList");
const quizRestartBtn = document.getElementById("quizRestart");

const quiz = { pool: [], index: 0, correct: 0, wrong: 0, answered: false, wrongAnswers: [] };

const byKanji = new Map(KANJI_DATA.map((d) => [d.kanji, d]));

const GRADE_LABELS = {
  "1": "초등학교 1학년",
  "2": "초등학교 2학년",
  "3": "초등학교 3학년",
  "4": "초등학교 4학년",
  "5": "초등학교 5학년",
  "6": "초등학교 6학년",
  middle: "중학교 이상",
};

const CERT_ORDER = [
  "8급", "7급", "준7급", "6급", "준6급", "5급", "준5급", "4급", "준4급",
  "3급", "준3급", "2급", "1급", "준특급", "특급",
];

const JLPT_LABELS = {
  5: "JLPT N5",
  4: "JLPT N4",
  3: "JLPT N3",
  2: "JLPT N2",
  1: "JLPT N1",
  none: "급수 미배정",
};

const CERT_TIER_LABELS = [...CERT_ORDER, "급수 없음"];
const JLPT_TIER_LABELS = [5, 4, 3, 2, 1, "none"].map((l) => JLPT_LABELS[l]);

function saveLearned() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...learned]));
}

function setLearned(kanji, isLearned) {
  if (isLearned) {
    learned.add(kanji);
  } else {
    learned.delete(kanji);
  }
  saveLearned();
  render();
}

function toggleLearned(kanji) {
  setLearned(kanji, !learned.has(kanji));
}

function matchesSearch(d, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (d.kanji === query.trim()) return true;
  if (d.krReading && d.krReading.includes(q)) return true;
  if (d.krHun && d.krHun.includes(q)) return true;
  if (d.on.some((r) => r.toLowerCase().includes(q))) return true;
  if (d.kun.some((r) => r.toLowerCase().includes(q))) return true;
  if (d.meaning && d.meaning.toLowerCase().includes(q)) return true;
  return false;
}

function matchesFilter(d, filter) {
  if (filter === "learned") return learned.has(d.kanji);
  if (filter === "unlearned") return !learned.has(d.kanji);
  return true;
}

function buildGroups(sortMode, items) {
  if (sortMode === "grade") {
    const order = ["1", "2", "3", "4", "5", "6", "middle"];
    return order
      .map((g) => ({
        label: GRADE_LABELS[g],
        items: items.filter((d) => d.grade === g),
      }))
      .filter((g) => g.items.length);
  }

  if (sortMode === "strokes") {
    const byStroke = new Map();
    for (const d of items) {
      const k = d.strokes ?? "?";
      if (!byStroke.has(k)) byStroke.set(k, []);
      byStroke.get(k).push(d);
    }
    return [...byStroke.keys()]
      .sort((a, b) => (a === "?" ? 1 : b === "?" ? -1 : a - b))
      .map((k) => ({ label: k === "?" ? "획수 미상" : `${k}획`, items: byStroke.get(k) }));
  }

  if (sortMode === "jlpt") {
    const order = [5, 4, 3, 2, 1, "none"];
    return order
      .map((lvl) => ({
        label: JLPT_LABELS[lvl],
        items: items.filter((d) => (d.jlpt ?? "none") === lvl),
      }))
      .filter((g) => g.items.length);
  }

  if (sortMode === "cert") {
    const order = [...CERT_ORDER, "none"];
    return order
      .map((grade) => ({
        label: grade === "none" ? "급수 없음" : grade,
        items: items.filter((d) => (CERT_ORDER.includes(d.krCertGrade) ? d.krCertGrade : "none") === grade),
      }))
      .filter((g) => g.items.length);
  }

  // kr: 가나다순, 그룹 없음
  const sorted = [...items].sort((a, b) =>
    (a.krReading || "").localeCompare(b.krReading || "", "ko")
  );
  return [{ label: null, items: sorted }];
}

function groupStats(sortMode) {
  const stats = new Map();
  for (const group of buildGroups(sortMode, KANJI_DATA)) {
    if (!group.label) continue;
    const total = group.items.length;
    const learnedCount = group.items.filter((d) => learned.has(d.kanji)).length;
    stats.set(group.label, { total, learnedCount });
  }
  return stats;
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeReading(s) {
  return (s || "").replace(/[()（）\s]/g, "");
}

function lowestIncompleteTierPool(sortMode, tierLabels) {
  const groups = buildGroups(sortMode, KANJI_DATA);
  const byLabel = new Map(groups.map((g) => [g.label, g]));
  for (const label of tierLabels) {
    const g = byLabel.get(label);
    if (!g) continue;
    const unlearned = g.items.filter((d) => !learned.has(d.kanji));
    if (unlearned.length) return unlearned.map((d) => d.kanji);
  }
  return [];
}

function computeAdaptivePool() {
  const certPool = lowestIncompleteTierPool("cert", CERT_TIER_LABELS);
  const jlptPool = lowestIncompleteTierPool("jlpt", JLPT_TIER_LABELS);
  return [...new Set([...certPool, ...jlptPool])];
}

function currentQuizScope() {
  return document.querySelector('input[name="quizScope"]:checked').value;
}

function populateGroupValueOptions() {
  const dim = quizGroupDim.value;
  const groups = buildGroups(dim, KANJI_DATA);
  quizGroupValue.innerHTML = "";
  for (const g of groups) {
    const unlearned = g.items.filter((d) => !learned.has(d.kanji)).length;
    const opt = document.createElement("option");
    opt.value = g.label;
    opt.textContent = `${g.label} (${unlearned}/${g.items.length} 미암기)`;
    quizGroupValue.appendChild(opt);
  }
}

function getPoolForCurrentSetup() {
  const scope = currentQuizScope();
  if (scope === "known") {
    return [...learned];
  }
  if (scope === "all") {
    return computeAdaptivePool();
  }
  // group
  const dim = quizGroupDim.value;
  const groups = buildGroups(dim, KANJI_DATA);
  const group = groups.find((g) => g.label === quizGroupValue.value);
  if (!group) return [];
  return group.items.filter((d) => !learned.has(d.kanji)).map((d) => d.kanji);
}

function updatePoolInfo() {
  const pool = getPoolForCurrentSetup();
  quizPoolInfo.textContent = pool.length
    ? `문제 ${pool.length}개 준비됨`
    : "이 조건에 해당하는 문제가 없습니다";
  quizStartBtn.disabled = pool.length === 0;
}

function openQuiz() {
  quizSetupEl.classList.remove("hidden");
  quizQuestionEl.classList.add("hidden");
  quizDoneEl.classList.add("hidden");
  populateGroupValueOptions();
  updatePoolInfo();
  quizOverlay.classList.remove("hidden");
}

function closeQuiz() {
  quizOverlay.classList.add("hidden");
}

function startQuiz() {
  const pool = shuffle(getPoolForCurrentSetup());
  if (!pool.length) return;

  quiz.pool = pool;
  quiz.index = 0;
  quiz.correct = 0;
  quiz.wrong = 0;
  quiz.wrongAnswers = [];

  quizSetupEl.classList.add("hidden");
  quizDoneEl.classList.add("hidden");
  quizQuestionEl.classList.remove("hidden");
  showQuizQuestion();
}

function showQuizQuestion() {
  if (quiz.index >= quiz.pool.length) {
    endQuiz();
    return;
  }
  const kanji = quiz.pool[quiz.index];
  const d = byKanji.get(kanji);
  quiz.answered = false;

  quizProgressText.textContent = `${quiz.index + 1} / ${quiz.pool.length} (정답 ${quiz.correct} · 오답 ${quiz.wrong})`;
  quizKanjiEl.textContent = d.kanji;
  quizInput.value = "";
  quizInput.disabled = false;
  quizFeedback.classList.add("hidden");
  quizNextBtn.classList.add("hidden");
  quizSubmitBtn.classList.remove("hidden");
  quizDontKnowBtn.classList.remove("hidden");
  quizInput.focus();
}

function resolveQuizAnswer(isCorrect, answerText, kanji, userInputText) {
  quiz.answered = true;
  if (isCorrect) {
    quiz.correct += 1;
    setLearned(kanji, true);
  } else {
    quiz.wrong += 1;
    quiz.wrongAnswers.push({ kanji, userInput: userInputText, answerText });
  }

  quizFeedback.textContent = isCorrect ? `정답! (${answerText})` : `오답 - 정답: ${answerText}`;
  quizFeedback.className = `quiz-feedback ${isCorrect ? "correct" : "incorrect"}`;
  quizFeedback.classList.remove("hidden");
  quizInput.disabled = true;
  quizSubmitBtn.classList.add("hidden");
  quizDontKnowBtn.classList.add("hidden");
  quizNextBtn.classList.remove("hidden");
  quizNextBtn.focus();
}

function submitQuizAnswer() {
  if (quiz.answered) return;
  const kanji = quiz.pool[quiz.index];
  const d = byKanji.get(kanji);
  const answerText = d.krHun ? `${d.krHun} ${d.krReading}` : d.krReading;
  const isCorrect = normalizeReading(quizInput.value) === normalizeReading(answerText);
  resolveQuizAnswer(isCorrect, answerText, kanji, quizInput.value.trim());
}

function markQuizDontKnow() {
  if (quiz.answered) return;
  const kanji = quiz.pool[quiz.index];
  const d = byKanji.get(kanji);
  const answerText = d.krHun ? `${d.krHun} ${d.krReading}` : d.krReading;
  resolveQuizAnswer(false, answerText, kanji, "(모름)");
}

function nextQuizQuestion() {
  quiz.index += 1;
  showQuizQuestion();
}

function endQuiz() {
  quizQuestionEl.classList.add("hidden");
  quizDoneEl.classList.remove("hidden");
  const total = quiz.correct + quiz.wrong;
  quizDoneText.textContent = `퀴즈 완료! 총 ${total}문제 중 정답 ${quiz.correct}개, 오답 ${quiz.wrong}개`;

  quizWrongList.innerHTML = "";
  if (quiz.wrongAnswers.length) {
    const table = document.createElement("table");
    table.className = "quiz-wrong-table";
    for (const w of quiz.wrongAnswers) {
      const tr = document.createElement("tr");

      const tdKanji = document.createElement("td");
      tdKanji.className = "quiz-wrong-kanji";
      tdKanji.textContent = w.kanji;

      const tdMine = document.createElement("td");
      tdMine.className = "quiz-wrong-mine";
      tdMine.textContent = w.userInput || "(공백)";

      const tdArrow = document.createElement("td");
      tdArrow.className = "quiz-wrong-arrow";
      tdArrow.textContent = "→";

      const tdCorrect = document.createElement("td");
      tdCorrect.className = "quiz-wrong-correct";
      tdCorrect.textContent = w.answerText;

      const tdAction = document.createElement("td");
      tdAction.className = "quiz-wrong-action";
      if (learned.has(w.kanji)) {
        const unlearnBtn = document.createElement("button");
        unlearnBtn.className = "btn quiz-unlearn-btn";
        unlearnBtn.textContent = "외운 것 해제";
        unlearnBtn.addEventListener("click", () => {
          setLearned(w.kanji, false);
          unlearnBtn.textContent = "해제됨";
          unlearnBtn.disabled = true;
        });
        tdAction.appendChild(unlearnBtn);
      }

      tr.append(tdKanji, tdMine, tdArrow, tdCorrect, tdAction);
      table.appendChild(tr);
    }
    quizWrongList.appendChild(table);
  }
}

function render() {
  const sortMode = sortSelect.value;
  const filter = filterSelect.value;
  const query = searchInput.value;

  const filtered = KANJI_DATA.filter(
    (d) => matchesFilter(d, filter) && matchesSearch(d, query)
  );

  const groups = buildGroups(sortMode, filtered);
  const stats = groupStats(sortMode);

  gridEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  for (const group of groups) {
    if (group.label) {
      const stat = stats.get(group.label);
      const pct = stat && stat.total ? Math.round((stat.learnedCount / stat.total) * 100) : 0;
      const labelEl = document.createElement("div");
      labelEl.className = "grid-group-label";
      labelEl.textContent = stat
        ? `${group.label} (${stat.learnedCount}/${stat.total}) (${pct}%)`
        : `${group.label} (${group.items.length})`;
      frag.appendChild(labelEl);
    }
    for (const d of group.items) {
      frag.appendChild(makeCell(d));
    }
  }

  gridEl.appendChild(frag);
  updateProgress();
}

function makeCell(d) {
  const cell = document.createElement("div");
  cell.className = "cell" + (learned.has(d.kanji) ? " learned" : "");
  cell.textContent = d.kanji;
  cell.dataset.kanji = d.kanji;
  cell.title = d.krHun ? `${d.krHun} ${d.krReading}` : d.krReading || d.kanji;
  cell.addEventListener("click", () => {
    if (quickCheckMode) {
      toggleLearned(d.kanji);
    } else {
      openModal(d.kanji);
    }
  });
  return cell;
}

function updateProgress() {
  const total = KANJI_DATA.length;
  const done = learned.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  progressText.textContent = `${done} / ${total} (${pct}%)`;
}

function openModal(kanji) {
  const d = byKanji.get(kanji);
  if (!d) return;
  activeKanji = kanji;

  modalKanji.textContent = d.kanji;
  learnedCheckbox.checked = learned.has(kanji);
  modalGrade.textContent = GRADE_LABELS[d.grade] || "-";
  modalStrokes.textContent = d.strokes != null ? `${d.strokes}획` : "-";
  modalJlpt.textContent = d.jlpt != null ? `N${d.jlpt}` : "미배정";
  modalReadings.textContent =
    [d.on.length ? `음독: ${d.on.join("、")}` : "", d.kun.length ? `훈독: ${d.kun.join("、")}` : ""]
      .filter(Boolean)
      .join("\n") || "-";
  modalMeaning.textContent = d.meaning || "-";
  modalKrReading.textContent = d.krHun ? `${d.krHun} ${d.krReading}` : d.krReading || "-";
  modalKrCert.textContent = d.krCertGrade || "-";
  modalExamples.textContent = d.krExamples.length ? d.krExamples.join("\n") : "-";

  modalOverlay.classList.remove("hidden");
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  activeKanji = null;
}

learnedCheckbox.addEventListener("change", () => {
  if (!activeKanji) return;
  setLearned(activeKanji, learnedCheckbox.checked);
});

quickCheckToggle.checked = quickCheckMode;
gridEl.classList.toggle("quick-check", quickCheckMode);

quickCheckToggle.addEventListener("change", () => {
  quickCheckMode = quickCheckToggle.checked;
  localStorage.setItem(QUICK_CHECK_KEY, quickCheckMode ? "1" : "0");
  gridEl.classList.toggle("quick-check", quickCheckMode);
});

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    closeQuiz();
  }
});

sortSelect.addEventListener("change", render);
filterSelect.addEventListener("change", render);
searchInput.addEventListener("input", render);

quizOpenBtn.addEventListener("click", openQuiz);
quizClose.addEventListener("click", closeQuiz);
quizOverlay.addEventListener("click", (e) => {
  if (e.target === quizOverlay) closeQuiz();
});

for (const radio of document.querySelectorAll('input[name="quizScope"]')) {
  radio.addEventListener("change", () => {
    quizGroupPicker.classList.toggle("hidden", currentQuizScope() !== "group");
    updatePoolInfo();
  });
}
quizGroupDim.addEventListener("change", () => {
  populateGroupValueOptions();
  updatePoolInfo();
});
quizGroupValue.addEventListener("change", updatePoolInfo);
quizStartBtn.addEventListener("click", startQuiz);

quizSubmitBtn.addEventListener("click", submitQuizAnswer);
quizDontKnowBtn.addEventListener("click", markQuizDontKnow);
quizNextBtn.addEventListener("click", nextQuizQuestion);
quizRestartBtn.addEventListener("click", openQuiz);
quizInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (quiz.answered) {
    nextQuizQuestion();
  } else {
    submitQuizAnswer();
  }
});

render();
