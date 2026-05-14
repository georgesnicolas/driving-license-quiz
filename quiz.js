"use strict";

const STORAGE_KEY = "quiz_selections_v1";
const CHEAT_KEY = "quiz_cheat_v1";
const RATING_KEY = "quiz_ratings_v1";
const MASTERED_KEY = "quiz_mastered_v1";

const DIFFICULTIES = [
  { value: "easy",   label: "سهل" },
  { value: "medium", label: "متوسط" },
  { value: "hard",   label: "صعب" },
];

const state = {
  allQuestions: [],   // full source list
  questions: [],      // current filtered list (excludes mastered)
  selections: {},   // qIndex -> answerIndex
  cheats: {},       // qIndex -> true
  ratings: {},      // qIndex -> 'easy' | 'medium' | 'hard'
  mastered: new Set(), // set of question.number values
  finished: false,
};

const el = {
  quiz: document.getElementById("quiz"),
  progress: document.getElementById("progress"),
  finishBtn: document.getElementById("finishBtn"),
  resetBtn: document.getElementById("resetBtn"),
  loadAllBtn: document.getElementById("loadAllBtn"),
  retryBtn: document.getElementById("retryBtn"),
  resultBar: document.getElementById("resultBar"),
  resultText: document.getElementById("resultText"),
};

function loadStorage() {
  try {
    state.selections = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch { state.selections = {}; }
  try {
    state.cheats = JSON.parse(localStorage.getItem(CHEAT_KEY) || "{}") || {};
  } catch { state.cheats = {}; }
  try {
    state.ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}") || {};
  } catch { state.ratings = {}; }
  try {
    const arr = JSON.parse(localStorage.getItem(MASTERED_KEY) || "[]") || [];
    state.mastered = new Set(arr);
  } catch { state.mastered = new Set(); }
}

function persistSelections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selections));
}
function persistCheats() {
  localStorage.setItem(CHEAT_KEY, JSON.stringify(state.cheats));
}
function persistRatings() {
  localStorage.setItem(RATING_KEY, JSON.stringify(state.ratings));
}
function persistMastered() {
  localStorage.setItem(MASTERED_KEY, JSON.stringify([...state.mastered]));
}

function applyMasteredFilter() {
  state.questions = state.allQuestions.filter(
    (q) => !state.mastered.has(q.number)
  );
}

function keyOf(qIdx) {
  const q = state.questions[qIdx];
  return q ? q.number : undefined;
}

function updateProgress() {
  // Count only selections that belong to currently visible questions.
  const visibleKeys = new Set(state.questions.map((q) => q.number));
  let answered = 0;
  for (const k of Object.keys(state.selections)) {
    if (visibleKeys.has(Number(k)) || visibleKeys.has(k)) answered++;
  }
  el.progress.textContent = `${answered} / ${state.questions.length}`;
}

function render() {
  const frag = document.createDocumentFragment();
  state.questions.forEach((q, qIdx) => {
    frag.appendChild(buildCard(q, qIdx));
  });
  el.quiz.replaceChildren(frag);
  updateProgress();
}

function buildCard(q, qIdx) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.qIndex = qIdx;
  if (state.cheats[q.number]) card.classList.add("cheat-on");

  // Header
  const header = document.createElement("div");
  header.className = "q-header";

  const num = document.createElement("span");
  num.className = "q-number";
  num.textContent = `#${q.number ?? qIdx + 1}`;
  header.appendChild(num);

  const title = document.createElement("h2");
  title.className = "q-title";
  title.textContent = q.question || "اختر الإجابة الصحيحة";
  title.title = "اضغط لتفعيل/إيقاف وضع الغش";
  title.addEventListener("click", () => toggleCheat(qIdx));
  header.appendChild(title);

  if (q.category) {
    const cat = document.createElement("span");
    cat.className = "q-category";
    cat.textContent = q.category;
    header.appendChild(cat);
  }

  card.appendChild(header);

  // Image
  if (q.image) {
    const wrap = document.createElement("div");
    wrap.className = "q-image";
    const img = document.createElement("img");
    img.src = `images/${q.image}`;
    img.alt = q.question || "صورة السؤال";
    img.loading = "lazy";
    wrap.appendChild(img);
    card.appendChild(wrap);
  }

  // Answers
  const list = document.createElement("div");
  list.className = "answers";
  q.answers.forEach((a, aIdx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer";
    btn.dataset.aIndex = aIdx;

    const dot = document.createElement("span");
    dot.className = "dot";
    btn.appendChild(dot);

    const label = document.createElement("span");
    label.textContent = a.text;
    btn.appendChild(label);

    btn.addEventListener("click", () => selectAnswer(qIdx, aIdx));
    list.appendChild(btn);
  });
  card.appendChild(list);

  // Cheat hint
  const hint = document.createElement("p");
  hint.className = "cheat-hint";
  hint.textContent = "💡 تم إبراز الإجابة الصحيحة";
  card.appendChild(hint);

  // Difficulty rating
  const rating = document.createElement("div");
  rating.className = "rating";
  const ratingLabel = document.createElement("span");
  ratingLabel.className = "rating-label";
  ratingLabel.textContent = "درجة الصعوبة:";
  rating.appendChild(ratingLabel);
  DIFFICULTIES.forEach(({ value, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `rating-btn rating-${value}`;
    btn.dataset.rating = value;
    btn.textContent = label;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      setRating(qIdx, value);
    });
    rating.appendChild(btn);
  });
  card.appendChild(rating);

  applyCardState(card, qIdx);
  return card;
}

function setRating(qIdx, value) {
  const key = keyOf(qIdx);
  if (state.ratings[key] === value) {
    delete state.ratings[key];
  } else {
    state.ratings[key] = value;
  }
  persistRatings();
  const card = el.quiz.querySelector(`.card[data-q-index="${qIdx}"]`);
  if (card) applyCardState(card, qIdx);
}

function applyCardState(card, qIdx) {
  const q = state.questions[qIdx];
  const key = q.number;
  const selected = state.selections[key];
  const cheatOn = !!state.cheats[key];
  const finished = state.finished;
  const isAnswered = selected != null;

  card.classList.toggle("cheat-on", cheatOn);

  card.querySelectorAll(".answer").forEach((btn) => {
    const aIdx = Number(btn.dataset.aIndex);
    const answer = q.answers[aIdx];
    btn.classList.remove("selected", "correct", "wrong", "cheat-correct");
    btn.disabled = false;

    if (finished && isAnswered) {
      btn.disabled = true;
      if (answer.correct) {
        btn.classList.add("correct");
      } else if (selected === aIdx) {
        btn.classList.add("wrong");
      }
      return;
    }

    if (cheatOn && answer.correct) {
      btn.classList.add("cheat-correct");
    }
    if (cheatOn) {
      btn.disabled = true;
    }
    if (selected === aIdx) {
      btn.classList.add("selected");
    }
  });

  const currentRating = state.ratings[key];
  card.querySelectorAll(".rating-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.rating === currentRating);
  });
}

function selectAnswer(qIdx, aIdx) {
  // Allow selecting answers on unanswered questions even after finish.
  if (state.finished && state.selections[keyOf(qIdx)] != null) return;
  state.selections[keyOf(qIdx)] = aIdx;
  persistSelections();
  const card = el.quiz.querySelector(`.card[data-q-index="${qIdx}"]`);
  if (card) applyCardState(card, qIdx);
  updateProgress();
}

const cheatTimers = {};
function toggleCheat(qIdx) {
  if (state.finished) return;
  const key = keyOf(qIdx);
  // Show correct answer for 2 seconds, then hide it.
  if (cheatTimers[key]) {
    clearTimeout(cheatTimers[key]);
    delete cheatTimers[key];
  }
  state.cheats[key] = true;
  const card = el.quiz.querySelector(`.card[data-q-index="${qIdx}"]`);
  if (card) applyCardState(card, qIdx);
  cheatTimers[key] = setTimeout(() => {
    delete state.cheats[key];
    delete cheatTimers[key];
    const c = el.quiz.querySelector(`.card[data-q-index="${qIdx}"]`);
    if (c) applyCardState(c, qIdx);
  }, 2000);
}

function finishQuiz() {
  state.finished = true;
  let score = 0;
  const newlyMastered = [];
  state.questions.forEach((q, qIdx) => {
    const sel = state.selections[q.number];
    const isCorrect = sel != null && q.answers[sel] && q.answers[sel].correct;
    if (isCorrect) score++;
    if (isCorrect && state.ratings[q.number] === "easy" && q.number != null) {
      newlyMastered.push(q.number);
    }
  });
  if (newlyMastered.length) {
    newlyMastered.forEach((n) => state.mastered.add(n));
    persistMastered();
  }
  el.quiz.querySelectorAll(".card").forEach((card) => {
    const qIdx = Number(card.dataset.qIndex);
    applyCardState(card, qIdx);
    const q = state.questions[qIdx];
    if (q && newlyMastered.includes(q.number)) {
      card.classList.add("hidden");
    }
  });

  // Reorder cards: wrong-easy, wrong-medium, wrong-hard, wrong-unrated,
  // then correct-hard, correct-medium, correct-unrated, then unanswered last.
  // (Correct + easy is mastered/hidden so it doesn't appear.)
  const priority = (q) => {
    const sel = state.selections[q.number];
    if (sel == null) return 7; // unanswered → last
    const isCorrect = q.answers[sel] && q.answers[sel].correct;
    const rating = state.ratings[q.number];
    if (!isCorrect) {
      if (rating === "easy")   return 0;
      if (rating === "medium") return 1;
      if (rating === "hard")   return 2;
      return 3;
    }
    if (rating === "hard")   return 4;
    if (rating === "medium") return 5;
    return 6;
  };
  const cards = Array.from(el.quiz.querySelectorAll(".card"));
  cards.sort((a, b) => {
    const qa = state.questions[Number(a.dataset.qIndex)];
    const qb = state.questions[Number(b.dataset.qIndex)];
    const pa = priority(qa);
    const pb = priority(qb);
    if (pa !== pb) return pa - pb;
    return (qa.number ?? 0) - (qb.number ?? 0);
  });
  cards.forEach((c) => el.quiz.appendChild(c));

  el.resultText.textContent = `النتيجة: ${score} من ${state.questions.length} (${((score / state.questions.length) * 100).toFixed(1)}%)`;
  el.resultBar.classList.remove("hidden");
  el.finishBtn.disabled = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetQuiz() {
  if (!confirm("سيتم حذف جميع إجاباتك. هل أنت متأكد؟")) return;
  state.selections = {};
  state.cheats = {};
  state.ratings = {};
  state.finished = false;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHEAT_KEY);
  localStorage.removeItem(RATING_KEY);
  applyMasteredFilter();
  el.resultBar.classList.add("hidden");
  el.finishBtn.disabled = false;
  render();
}

function loadAllQuestions() {
  if (!confirm("سيتم إعادة تحميل جميع الأسئلة وحذف إجاباتك الحالية. هل أنت متأكد؟")) return;
  state.mastered = new Set();
  state.selections = {};
  state.cheats = {};
  state.ratings = {};
  state.finished = false;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CHEAT_KEY);
  localStorage.removeItem(RATING_KEY);
  localStorage.removeItem(MASTERED_KEY);
  applyMasteredFilter();
  el.resultBar.classList.add("hidden");
  el.finishBtn.disabled = false;
  render();
}

async function init() {
  loadStorage();
  try {
    if (Array.isArray(window.QUIZ_QUESTIONS)) {
      state.allQuestions = window.QUIZ_QUESTIONS;
    } else {
      const res = await fetch("questions.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.allQuestions = await res.json();
    }
  } catch (err) {
    el.quiz.innerHTML = `<div class="card"><p style="color:var(--wrong)">تعذّر تحميل الأسئلة: ${err.message}</p></div>`;
    return;
  }
  applyMasteredFilter();
  console.log("[quiz] mastered:", [...state.mastered], "visible:", state.questions.length, "/", state.allQuestions.length);
  render();
}

el.finishBtn.addEventListener("click", finishQuiz);
el.resetBtn.addEventListener("click", resetQuiz);
if (el.loadAllBtn) el.loadAllBtn.addEventListener("click", loadAllQuestions);
el.retryBtn.addEventListener("click", resetQuiz);

init();
