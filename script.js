// ============================================================
//  Ramadan Genius — Quiz Competition Script
//  ফুলকুঁড়ি আশার ঝিঙ্গেফুল
// ============================================================

// ====== CONFIG ======
const APPS_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";
const SECRET = "CHANGE_THIS_TO_A_LONG_RANDOM_STRING";

const SECONDS_PER_QUESTION = 20;
const TOTAL_QUESTIONS = 60;
const STORAGE_KEY = "ramadan_genius_v2";

// Contest window: Asia/Dhaka
const CONTEST_START_ISO = "2026-03-07T10:00:00+06:00";
const CONTEST_END_ISO = "2026-03-08T10:00:00+06:00";
const CONTEST_START_MS = Date.parse(CONTEST_START_ISO);
const CONTEST_END_MS = Date.parse(CONTEST_END_ISO);
const SUBMISSION_GRACE_MINUTES = 30;
const CONTEST_GRACE_END_MS = CONTEST_END_MS + SUBMISSION_GRACE_MINUTES * 60 * 1000;
const DHAKA_TZ = "Asia/Dhaka";

// Submission retry strategy
const SUBMIT_MAX_ATTEMPTS = 6;
const SUBMIT_BASE_DELAY_MS = 1200;
const SUBMIT_MAX_DELAY_MS = 15000;

// ====== STATE ======
let allQuestions = {};
let state = null;
let timerHandle = null;
let gateHandle = null;
let selectedCategory = null;
let finishing = false;

// ====== HELPERS ======
function $(id) { return document.getElementById(id); }

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newSessionId() {
  return "s_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

function saveState() {
  if (!state) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function show(id) { $(id).style.display = ""; }
function hide(id) { $(id).style.display = "none"; }

function toBanglaNum(n) {
  const bn = "০১২৩৪৫৬৭৮৯";
  return String(n).replace(/\d/g, (d) => bn[d]);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const rem = totalSec % 86400;
  const hours = Math.floor(rem / 3600);
  const mins = Math.floor((rem % 3600) / 60);
  const secs = rem % 60;

  const hms = `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`;
  if (days > 0) {
    return `${toBanglaNum(days)} দিন ${toBanglaNum(hms)}`;
  }
  return toBanglaNum(hms);
}

function formatDhakaDate(ms) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: DHAKA_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
  return fmt.format(new Date(ms));
}

function getContestPhase(nowMs = Date.now()) {
  if (nowMs < CONTEST_START_MS) return "before";
  if (nowMs <= CONTEST_END_MS) return "live";
  if (nowMs <= CONTEST_GRACE_END_MS) return "grace";
  return "after";
}

function isContestLive(nowMs = Date.now()) {
  return getContestPhase(nowMs) === "live";
}

function canSubmitInGraceForSession(session, nowMs = Date.now()) {
  if (!session) return false;
  const startedAtMs = Number(session.startedAtClientMs || 0);
  return startedAtMs > 0 && startedAtMs <= CONTEST_END_MS && nowMs <= CONTEST_GRACE_END_MS;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryDelayMs(attemptNum) {
  const exponential = Math.min(SUBMIT_MAX_DELAY_MS, SUBMIT_BASE_DELAY_MS * (2 ** (attemptNum - 1)));
  const jitter = Math.floor(Math.random() * 700);
  return exponential + jitter;
}

function contestStatusMessage() {
  const phase = getContestPhase();
  if (phase === "before") {
    return "প্রতিযোগিতা এখনো শুরু হয়নি। / Contest has not started yet.";
  }
  if (phase === "grace" || phase === "after") {
    return "প্রতিযোগিতা শেষ হয়েছে। / Contest has ended.";
  }
  return "";
}

// ====== OPENING GATE / COUNTDOWN ======
function renderGate() {
  const phase = getContestPhase();
  const now = Date.now();

  $("gateSchedule").innerHTML =
    `সময় (Asia/Dhaka): ${formatDhakaDate(CONTEST_START_MS)} থেকে ${formatDhakaDate(CONTEST_END_MS)}<br/>` +
    `Grace submit (আগে শুরু করাদের জন্য): ${formatDhakaDate(CONTEST_GRACE_END_MS)} পর্যন্ত`;

  if (phase === "before") {
    $("gateTitle").innerText = "⏳ প্রতিযোগিতা শুরু হবে";
    $("gateMessage").innerHTML =
      "নিচের কাউন্টডাউন শেষ হলে কুইজ শুরু করতে পারবেন।<br/>You can enter the quiz when the countdown reaches zero.";
    $("gateCountdown").innerText = formatCountdown(CONTEST_START_MS - now);
    hide("enterBtn");
    return;
  }

  if (phase === "after") {
    $("gateTitle").innerText = "🔒 প্রতিযোগিতা শেষ";
    $("gateMessage").innerHTML =
      "নির্ধারিত সময় শেষ হয়েছে।<br/>The competition window is closed.";
    $("gateCountdown").innerText = "০০:০০:০০";
    hide("enterBtn");
    return;
  }

  if (phase === "grace") {
    $("gateTitle").innerText = "🕒 Submission Grace চলছে";
    $("gateMessage").innerHTML =
      "নতুন কুইজ শুরু করা যাবে না। যারা আগে শুরু করেছে তারা কেবল submit/retry করতে পারবে।<br/>" +
      "No new quiz starts. Only previously started participants may submit/retry.";
    $("gateCountdown").innerText = formatCountdown(CONTEST_GRACE_END_MS - now);
    hide("enterBtn");
    return;
  }

  $("gateTitle").innerText = "✅ প্রতিযোগিতা চলছে";
  $("gateMessage").innerHTML =
    "এখন অংশগ্রহণ করা যাবে। নিচে শেষ হওয়ার কাউন্টডাউন দেখুন।<br/>The competition is live now.";
  $("gateCountdown").innerText = formatCountdown(CONTEST_END_MS - now);
  show("enterBtn");
}

function startGateTicker() {
  clearInterval(gateHandle);
  renderGate();
  gateHandle = setInterval(renderGate, 1000);
}

function enterQuizFromGate() {
  if (!isContestLive()) {
    renderGate();
    return;
  }
  hide("gateCard");
  show("startCard");
}

// ====== CATEGORY SELECTION ======
function setupCategoryPicker() {
  const catBtnA = $("catBtnA");
  const catBtnB = $("catBtnB");

  catBtnA.addEventListener("click", () => {
    selectedCategory = "A";
    catBtnA.classList.add("active");
    catBtnB.classList.remove("active");
  });

  catBtnB.addEventListener("click", () => {
    selectedCategory = "B";
    catBtnB.classList.add("active");
    catBtnA.classList.remove("active");
  });
}

function autoSelectCategory() {
  const cls = parseInt($("fClass").value, 10);
  if (!cls) return;

  if (cls >= 3 && cls <= 5) {
    selectedCategory = "A";
    $("catBtnA").classList.add("active");
    $("catBtnB").classList.remove("active");
    return;
  }

  if (cls >= 6 && cls <= 10) {
    selectedCategory = "B";
    $("catBtnB").classList.add("active");
    $("catBtnA").classList.remove("active");
  }
}

// ====== LOAD QUESTIONS ======
async function loadQuestions() {
  const res = await fetch("questions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load questions.json");

  const data = await res.json();
  if (!data.A || !data.B) {
    throw new Error("questions.json must include A and B category arrays.");
  }

  allQuestions = data;
}

// ====== RENDER QUESTION ======
function renderQuestion() {
  const idx = state.currentIndex;
  const total = state.quiz.length;
  const q = state.quiz[idx];

  $("progressText").innerText = `Q ${idx + 1} / ${total}`;
  $("progressBar").style.width = ((idx + 1) / total * 100).toFixed(1) + "%";
  $("qNumber").innerText = `প্রশ্ন ${toBanglaNum(idx + 1)}`;

  $("qTextBn").innerText = q.q_bn || "";
  const enText = q.q_en || "";
  $("qTextEn").innerText = enText;
  $("qTextEn").style.display = enText ? "" : "none";

  const list = $("optionsList");
  list.innerHTML = "";

  const markers = ["A", "B", "C", "D"];

  q.options.forEach((opt, i) => {
    const label = document.createElement("label");
    label.className = "opt-label" + (state.answers[q.id] === opt.id ? " selected" : "");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "quizOpt";
    radio.value = opt.id;

    const marker = document.createElement("span");
    marker.className = "opt-marker";
    marker.innerText = markers[i] || opt.id;

    const textWrap = document.createElement("span");

    const bnSpan = document.createElement("span");
    bnSpan.className = "opt-text-bn";
    bnSpan.innerText = opt.text_bn || "";
    textWrap.appendChild(bnSpan);

    if (opt.text_en) {
      const enSpan = document.createElement("span");
      enSpan.className = "opt-text-en";
      enSpan.innerText = " — " + opt.text_en;
      textWrap.appendChild(enSpan);
    }

    label.appendChild(radio);
    label.appendChild(marker);
    label.appendChild(textWrap);

    label.addEventListener("click", () => {
      state.answers[q.id] = opt.id;
      saveState();
      list.querySelectorAll(".opt-label").forEach((item) => item.classList.remove("selected"));
      label.classList.add("selected");
    });

    list.appendChild(label);
  });

  $("nextBtn").innerText = idx >= total - 1 ? "জমা দিন / Submit ✓" : "পরবর্তী / Next ➜";
}

// ====== TIMER ======
function startQuestionTimer() {
  clearInterval(timerHandle);

  const circle = $("timerCircle");
  timerHandle = setInterval(() => {
    if (Date.now() > CONTEST_END_MS) {
      finishQuiz();
      return;
    }

    const remaining = Math.max(0, Math.ceil((state.questionEndsAt - Date.now()) / 1000));
    circle.innerText = String(remaining);

    circle.classList.remove("warn", "danger");
    if (remaining <= 5) {
      circle.classList.add("danger");
    } else if (remaining <= 10) {
      circle.classList.add("warn");
    }

    if (remaining <= 0) {
      goToNextQuestion();
    }
  }, 200);
}

// ====== NEXT QUESTION ======
function goToNextQuestion() {
  if (!state) return;

  clearInterval(timerHandle);
  state.currentIndex++;

  if (state.currentIndex >= state.quiz.length) {
    finishQuiz();
    return;
  }

  state.questionEndsAt = Date.now() + SECONDS_PER_QUESTION * 1000;
  saveState();
  renderQuestion();
  startQuestionTimer();
}

// ====== START QUIZ ======
function startQuiz() {
  if (!isContestLive()) {
    $("startError").innerText = contestStatusMessage();
    return;
  }

  const name = $("fName").value.trim();
  const cls = $("fClass").value;
  const phone = $("fPhone").value.trim();
  const school = $("fSchool").value.trim();
  const address = $("fAddress").value.trim();
  const father = $("fFather").value.trim();
  const mother = $("fMother").value.trim();

  if (!name) { $("startError").innerText = "নাম লিখুন / Please enter your name."; return; }
  if (!cls) { $("startError").innerText = "শ্রেণি নির্বাচন করুন / Please select your class."; return; }
  if (!phone) { $("startError").innerText = "ফোন নম্বর লিখুন / Please enter phone number."; return; }
  if (!school) { $("startError").innerText = "বিদ্যালয়ের নাম লিখুন / Please enter school name."; return; }
  if (!selectedCategory) {
    $("startError").innerText = "ক্যাটাগরি নির্বাচন করুন / Please select a category.";
    return;
  }

  const clsNum = parseInt(cls, 10);
  if (selectedCategory === "A" && (clsNum < 3 || clsNum > 5)) {
    $("startError").innerText = "Category A is for Class 3-5 only / ক্যাটাগরি এ শুধুমাত্র ৩-৫ শ্রেণির জন্য।";
    return;
  }
  if (selectedCategory === "B" && (clsNum < 6 || clsNum > 10)) {
    $("startError").innerText = "Category B is for Class 6-10 only / ক্যাটাগরি বি শুধুমাত্র ৬-১০ শ্রেণির জন্য।";
    return;
  }

  const catQuestions = allQuestions[selectedCategory];
  if (!catQuestions || catQuestions.length === 0) {
    $("startError").innerText = `No questions found for Category ${selectedCategory}.`;
    return;
  }

  $("startError").innerText = "";

  const actualTotal = Math.min(TOTAL_QUESTIONS, catQuestions.length);
  const quiz = shuffle(catQuestions).slice(0, actualTotal).map((q) => ({
    id: q.id,
    q_bn: q.q_bn || "",
    q_en: q.q_en || "",
    options: shuffle(q.options)
  }));

  state = {
    version: 2,
    sessionId: newSessionId(),
    category: selectedCategory,
    name,
    class: cls,
    phone,
    school,
    address,
    father,
    mother,
    startedAtClientMs: Date.now(),
    finishedAtClientMs: null,
    currentIndex: 0,
    questionEndsAt: Date.now() + SECONDS_PER_QUESTION * 1000,
    quiz,
    answers: {},
    submitted: false
  };

  saveState();

  hide("startCard");
  hide("gateCard");
  show("quizCard");
  renderQuestion();
  startQuestionTimer();
}

// ====== RESUME ======
function resumeIfPossible() {
  const s = loadState();
  if (!s || s.submitted) return false;
  if (!s.quiz || !Array.isArray(s.quiz) || s.quiz.length === 0) return false;
  if (!(isContestLive() || canSubmitInGraceForSession(s))) return false;

  state = s;

  if (state.currentIndex >= state.quiz.length) {
    hide("gateCard");
    hide("startCard");
    show("finishCard");
    $("finishMsg").innerHTML =
      "আপনার আগের কুইজ জমা হয়নি। আবার চেষ্টা করুন।<br/>Your previous quiz was not submitted. Please retry.";
    $("retryBtn").style.display = "";
    return true;
  }

  while (Date.now() >= state.questionEndsAt && state.currentIndex < state.quiz.length) {
    state.currentIndex++;
    state.questionEndsAt = Date.now() + SECONDS_PER_QUESTION * 1000;
  }

  if (state.currentIndex >= state.quiz.length) {
    finishQuiz();
    return true;
  }

  hide("gateCard");
  hide("startCard");
  show("quizCard");
  renderQuestion();
  startQuestionTimer();
  return true;
}

// ====== BUILD PAYLOAD ======
function buildPayload() {
  const started = new Date(state.startedAtClientMs);
  const finished = new Date(state.finishedAtClientMs || Date.now());
  const answersArray = Object.entries(state.answers).map(([qid, a]) => ({ qid, a }));

  return {
    version: 2,
    sessionId: state.sessionId,
    category: state.category,
    name: state.name,
    class: state.class,
    phone: state.phone,
    school: state.school,
    address: state.address,
    father: state.father,
    mother: state.mother,
    startedAtClient: started.toISOString(),
    finishedAtClient: finished.toISOString(),
    durationSecClient: Math.round((finished.getTime() - started.getTime()) / 1000),
    answers: answersArray,
    userAgent: navigator.userAgent
  };
}

// ====== SUBMIT via HIDDEN FORM (CORS-safe) ======
function submitToSheet(payload) {
  return new Promise((resolve) => {
    const form = $("submitForm");
    $("secretField").value = SECRET;
    $("payloadField").value = JSON.stringify(payload);
    form.action = APPS_SCRIPT_URL;

    const iframe = $("hiddenFrame");
    let done = false;

    iframe.onload = () => {
      if (done) return;
      done = true;
      resolve(true);
    };

    form.submit();

    setTimeout(() => {
      if (done) return;
      done = true;
      resolve(false);
    }, 15000);
  });
}

async function submitWithRetry(payload, hooks = {}) {
  for (let attempt = 1; attempt <= SUBMIT_MAX_ATTEMPTS; attempt++) {
    if (typeof hooks.onAttempt === "function") {
      hooks.onAttempt(attempt, SUBMIT_MAX_ATTEMPTS);
    }

    const ok = await submitToSheet(payload);
    if (ok) {
      return { ok: true, attempts: attempt };
    }

    if (attempt < SUBMIT_MAX_ATTEMPTS) {
      const delayMs = computeRetryDelayMs(attempt);
      if (typeof hooks.onRetryWait === "function") {
        hooks.onRetryWait(attempt, SUBMIT_MAX_ATTEMPTS, delayMs);
      }
      await wait(delayMs);
    }
  }

  return { ok: false, attempts: SUBMIT_MAX_ATTEMPTS };
}

// ====== FINISH QUIZ ======
async function finishQuiz() {
  if (finishing || !state) return;
  finishing = true;

  clearInterval(timerHandle);

  state.finishedAtClientMs = state.finishedAtClientMs || Date.now();
  saveState();

  hide("quizCard");
  hide("startCard");
  hide("gateCard");
  show("finishCard");

  $("finishMsg").innerHTML =
    "আপনার উত্তর জমা দেওয়া হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।<br/>Submitting your answers... please wait.";
  $("retryBtn").style.display = "none";

  if (!isContestLive() && !canSubmitInGraceForSession(state)) {
    $("finishMsg").innerHTML =
      "⚠️ Submission grace window শেষ হয়ে গেছে। আর submit করা যাবে না।<br/>" +
      "Submission grace window has ended.";
    $("retryBtn").style.display = "none";
    finishing = false;
    return;
  }

  const payload = buildPayload();
  const result = await submitWithRetry(payload, {
    onAttempt: (attempt, max) => {
      $("finishMsg").innerHTML =
        `জমা দেওয়ার চেষ্টা চলছে (${toBanglaNum(attempt)}/${toBanglaNum(max)})...<br/>` +
        `Submitting attempt ${attempt}/${max}...`;
    },
    onRetryWait: (attempt, max, delayMs) => {
      const waitSec = Math.ceil(delayMs / 1000);
      $("finishMsg").innerHTML =
        `নেটওয়ার্ক ব্যস্ত। আবার চেষ্টা হবে (${toBanglaNum(attempt + 1)}/${toBanglaNum(max)}) ` +
        `${toBanglaNum(waitSec)} সেকেন্ড পরে...<br/>` +
        `Network busy. Retrying in ${waitSec}s (next attempt ${attempt + 1}/${max})...`;
    }
  });

  if (result.ok) {
    state.submitted = true;
    saveState();
    localStorage.removeItem(STORAGE_KEY);
    $("finishMsg").innerHTML =
      `✅ সফলভাবে জমা হয়েছে! (${toBanglaNum(result.attempts)} চেষ্টায়)<br/>` +
      `Submitted successfully in ${result.attempts} attempt(s). You may close this page.`;
    finishing = false;
    return;
  }

  if (!canSubmitInGraceForSession(state) && !isContestLive()) {
    $("finishMsg").innerHTML =
      "⚠️ Submission grace window শেষ হয়ে গেছে। আর submit করা যাবে না।<br/>" +
      "Submission grace window has ended.";
    $("retryBtn").style.display = "none";
    finishing = false;
    return;
  }

  $("finishMsg").innerHTML =
    "⚠️ স্বয়ংক্রিয় সব retry শেষ। Retry চাপুন, সিস্টেম আবার কয়েকবার চেষ্টা করবে।<br/>" +
    "All auto-retries failed. Press Retry to run another retry cycle.";
  $("retryBtn").style.display = "";
  finishing = false;
}

// ====== RETRY ======
async function retrySubmit() {
  if (!state) return;

  if (!isContestLive() && !canSubmitInGraceForSession(state)) {
    $("finishMsg").innerHTML =
      "⚠️ Submission grace window শেষ হয়ে গেছে। আর submit করা যাবে না।<br/>" +
      "Submission grace window has ended.";
    $("retryBtn").style.display = "none";
    return;
  }

  $("finishMsg").innerHTML =
    "আবার চেষ্টা করা হচ্ছে...<br/>Retrying submission...";
  $("retryBtn").style.display = "none";

  const payload = buildPayload();
  const result = await submitWithRetry(payload, {
    onAttempt: (attempt, max) => {
      $("finishMsg").innerHTML =
        `Retry cycle: জমা দেওয়ার চেষ্টা (${toBanglaNum(attempt)}/${toBanglaNum(max)})...<br/>` +
        `Retry cycle attempt ${attempt}/${max}...`;
    },
    onRetryWait: (attempt, max, delayMs) => {
      const waitSec = Math.ceil(delayMs / 1000);
      $("finishMsg").innerHTML =
        `Retry cycle: আবার চেষ্টা হবে (${toBanglaNum(attempt + 1)}/${toBanglaNum(max)}) ` +
        `${toBanglaNum(waitSec)} সেকেন্ড পরে...<br/>` +
        `Retry cycle waiting ${waitSec}s for attempt ${attempt + 1}/${max}...`;
    }
  });

  if (result.ok) {
    state.submitted = true;
    saveState();
    localStorage.removeItem(STORAGE_KEY);
    $("finishMsg").innerHTML =
      `✅ সফলভাবে জমা হয়েছে! (${toBanglaNum(result.attempts)} চেষ্টায়)<br/>` +
      `Submitted successfully in ${result.attempts} attempt(s). You may close this page.`;
    return;
  }

  if (!isContestLive() && !canSubmitInGraceForSession(state)) {
    $("finishMsg").innerHTML =
      "⚠️ Submission grace window শেষ হয়ে গেছে। আর submit করা যাবে না।<br/>" +
      "Submission grace window has ended.";
    $("retryBtn").style.display = "none";
    return;
  }

  $("finishMsg").innerHTML =
    "⚠️ এখনও জমা হচ্ছে না। নেট পরিবর্তন করে Retry দিন।<br/>Still failing. Switch network and press Retry.";
  $("retryBtn").style.display = "";
}

// ====== INIT ======
window.addEventListener("beforeunload", (e) => {
  if (state && !state.submitted && state.currentIndex < (state.quiz ? state.quiz.length : 0)) {
    e.preventDefault();
    e.returnValue = "";
  }
});

window.addEventListener("load", async () => {
  setupCategoryPicker();
  $("fClass").addEventListener("change", autoSelectCategory);

  $("enterBtn").addEventListener("click", enterQuizFromGate);
  $("startBtn").addEventListener("click", startQuiz);
  $("nextBtn").addEventListener("click", goToNextQuestion);
  $("retryBtn").addEventListener("click", retrySubmit);

  startGateTicker();

  try {
    await loadQuestions();
  } catch (err) {
    $("startError").innerText = "⚠️ প্রশ্ন লোড করতে সমস্যা / Error loading questions: " + err.message;
    $("startBtn").disabled = true;
    return;
  }

  if (resumeIfPossible()) {
    return;
  }

  if (isContestLive()) {
    show("gateCard");
  }
});
