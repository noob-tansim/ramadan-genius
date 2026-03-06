// ============================================================
//  Ramadan Genius — Quiz Competition Script
//  ফুলকুঁড়ি আসর ঝিঙ্গেফুল
// ============================================================

// ====== CONFIG ======
// Add all your Apps Script Web App URLs here (1 to 3 accounts)
// Each URL is a deployed Web App from a different Google account
const APPS_SCRIPT_URLS = [
  "https://script.google.com/macros/s/AKfycbwvkQWAVqYVbBkLPI1My7R7kSv9jrhKYG9axgQ74Q_bXRtnYNaHgbuNgA6EHZd2uMcokA/exec",
  // "PASTE_URL_FROM_GOOGLE_ACCOUNT_2",  // uncomment when ready
  // "PASTE_URL_FROM_GOOGLE_ACCOUNT_3",  // uncomment when ready
];
const SECRET = "rg2026_phulkuri_secretKey99";

// Pick a random endpoint for each submission (load balancing)
let _submitCounter = 0;
function getNextEndpoint() {
  const url = APPS_SCRIPT_URLS[_submitCounter % APPS_SCRIPT_URLS.length];
  _submitCounter++;
  return url;
}

const SECONDS_PER_QUESTION = 20;
const TOTAL_QUESTIONS = 60;
const STORAGE_KEY = "ramadan_genius_v2";

// Contest window: Asia/Dhaka — March 9 8AM to March 10 11:30PM
const CONTEST_START_ISO = "2026-03-09T08:00:00+06:00";
const CONTEST_END_ISO   = "2026-03-10T23:30:00+06:00";
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
let currentLang = "bn"; // "bn" or "en"

// ====== i18n — LANDING PAGE TRANSLATIONS ======
const i18n = {
  bn: {
    gateTitle_before: "\u{1F319} \u09B0\u09AE\u09BE\u09A6\u09BE\u09A8 \u099C\u09BF\u09A8\u09BF\u09AF\u09BC\u09BE\u09B8 \u09E8\u09E6\u09E8\u09EC",
    gateTitle_live: "\u2705 \u09AA\u09CD\u09B0\u09A4\u09BF\u09AF\u09CB\u0997\u09BF\u09A4\u09BE \u099A\u09B2\u099B\u09C7",
    gateTitle_grace: "\u{1F552} Submission Grace \u099A\u09B2\u099B\u09C7",
    gateTitle_after: "\u{1F512} \u09AA\u09CD\u09B0\u09A4\u09BF\u09AF\u09CB\u0997\u09BF\u09A4\u09BE \u09B6\u09C7\u09B7",
    salam: "\u0986\u09B8\u09B8\u09BE\u09B2\u09BE\u09AE\u09C1\u09AF\u09BC\u09BE\u09B2\u09BE\u0987\u0995\u09C1\u09AE",
    desc: '\u09AA\u09AC\u09BF\u09A4\u09CD\u09B0 \u09AE\u09BE\u09B9\u09C7 \u09B0\u09AE\u099C\u09BE\u09A8\u0995\u09C7 \u09B8\u09BE\u09AE\u09A8\u09C7 \u09B0\u09C7\u0996\u09C7 \u09B6\u09BF\u09B6\u09C1 \u09AC\u09BF\u0995\u09BE\u09B6 \u0995\u09BE\u09B0\u09CD\u09AF\u0995\u09CD\u09B0\u09AE\u09C7\u09B0 \u0985\u0982\u09B6 \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7 <strong style="color:var(--accent)">\u09AB\u09C1\u09B2\u0995\u09C1\u0981\u09DC\u09BF \u0986\u09B8\u09B0</strong> \u09A2\u09BE\u0995\u09BE \u09AE\u09B9\u09BE\u09A8\u0997\u09B0\u09C0 \u099D\u09BF\u0999\u09CD\u0997\u09C7\u09AB\u09C1\u09B2 \u09B6\u09BE\u0996\u09BE \u0986\u09AF\u09BC\u09CB\u099C\u09A8 \u0995\u09B0\u099B\u09C7 <strong style="color:var(--gold)">\u201C\u09B0\u09AE\u09BE\u09A6\u09BE\u09A8 \u099C\u09BF\u09A8\u09BF\u09AF\u09BC\u09BE\u09B8 \u09E8\u09E6\u09E8\u09EC\u201D</strong>\u0964 \u098F\u0987 \u0985\u09A8\u09A8\u09CD\u09AF \u0986\u09AF\u09BC\u09CB\u099C\u09A8\u099F\u09BF \u0986\u0997\u09BE\u09AE\u09C0 <strong>\u09EF-\u09E7\u09E6 \u09AE\u09BE\u09B0\u09CD\u099A</strong> \u09E8 \u09A6\u09BF\u09A8\u09AC\u09CD\u09AF\u09BE\u09AA\u09C0 \u0985\u09A8\u09B2\u09BE\u0987\u09A8\u09C7 \u0985\u09A8\u09C1\u09B7\u09CD\u09A0\u09BF\u09A4 \u09B9\u09AC\u09C7\u0964',
    rulesTitle: "\u{1F4CB} \u09A8\u09BF\u09AF\u09BC\u09AE\u09BE\u09AC\u09B2\u09C0",
    rules: [
      '<strong>\u0997\u09CD\u09B0\u09C1\u09AA \u0995:</strong> \u09E9\u09AF\u09BC \u2014 \u09EB\u09AE \u09B6\u09CD\u09B0\u09C7\u09A3\u09BF &nbsp;|&nbsp; <strong>\u0997\u09CD\u09B0\u09C1\u09AA \u0996:</strong> \u09EC\u09B7\u09CD\u09A0 \u2014 \u09E7\u09E6\u09AE \u09B6\u09CD\u09B0\u09C7\u09A3\u09BF',
      '\u09EC\u09E6\u099F\u09BF MCQ \u09AA\u09CD\u09B0\u09B6\u09CD\u09A8, \u09B8\u09AE\u09AF\u09BC \u09E8\u09E6 \u09AE\u09BF\u09A8\u09BF\u099F',
      '\u09AA\u09CD\u09B0\u09A4\u09CD\u09AF\u09C7\u0995 \u09AA\u09CD\u09B0\u09B6\u09CD\u09A8\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u09E8\u09E6 \u09B8\u09C7\u0995\u09C7\u09A8\u09CD\u09A1 \u09B8\u09AE\u09AF\u09BC',
      '\u09AA\u09B0\u09AC\u09B0\u09CD\u09A4\u09C0/Next \u09AC\u09BE\u099F\u09A8\u09C7 \u0995\u09CD\u09B2\u09BF\u0995 \u0995\u09B0\u09BE\u09B0 \u09AA\u09B0 \u0986\u0997\u09C7\u09B0 \u09AA\u09CD\u09B0\u09B6\u09CD\u09A8\u09C7 \u09AB\u09BF\u09B0\u09C7 \u0986\u09B8\u09BE \u09AF\u09BE\u09AC\u09C7 \u09A8\u09BE',
      '\u09AA\u09CD\u09B0\u09A4\u09BF \u09AD\u09C1\u09B2 \u0989\u09A4\u09CD\u09A4\u09B0\u09C7 \u09E6.\u09E8\u09EB \u09A8\u09AE\u09CD\u09AC\u09B0 \u0995\u09BE\u099F\u09BE \u09AF\u09BE\u09AC\u09C7 (\u09A8\u09C7\u0997\u09C7\u099F\u09BF\u09AD \u09AE\u09BE\u09B0\u09CD\u0995\u09BF\u0982)',
      '\u09AC\u09BE\u0982\u09B2\u09BE \u0993 \u0987\u0982\u09B0\u09C7\u099C\u09BF \u09A6\u09C1\u0987 \u09AB\u09B0\u09AE\u09C7\u099F\u09C7 \u09AA\u09CD\u09B0\u09B6\u09CD\u09A8',
      '\u0986\u0995\u09B0\u09CD\u09B7\u09A3\u09C0\u09AF\u09BC \u09AA\u09C1\u09B0\u09B8\u09CD\u0995\u09BE\u09B0, \u09B8\u09BE\u09B0\u09CD\u099F\u09BF\u09AB\u09BF\u0995\u09C7\u099F \u0993 \u0995\u09CD\u09B0\u09C7\u09B8\u09CD\u099F',
      '\u09AB\u09C1\u09B2\u0995\u09C1\u0981\u09DC\u09BF\u09B0 \u09B8\u09A6\u09B8\u09CD\u09AF \u09B9\u0993\u09AF\u09BC\u09BE\u09B0 \u09AA\u09CD\u09B0\u09AF\u09BC\u09CB\u099C\u09A8 \u09A8\u09C7\u0987 \u2014 \u09B8\u0995\u09B2 \u09B6\u09BF\u0995\u09CD\u09B7\u09BE\u09B0\u09CD\u09A5\u09C0 \u0985\u0982\u09B6\u0997\u09CD\u09B0\u09B9\u09A3 \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7'
    ],
    syllabusATitle: "\u{1F4D6} \u0997\u09CD\u09B0\u09C1\u09AA \u0995 (\u09E9\u09AF\u09BC-\u09EB\u09AE)",
    syllabusABody: "\u2022 \u09B8\u09BE\u0993\u09AE\u09C7\u09B0 \u09AE\u09CC\u09B2\u09BF\u0995 \u099C\u09CD\u099E\u09BE\u09A8<br/>\u2022 \u0995\u09C1\u09B0\u0986\u09A8 \u09A8\u09BE\u099C\u09BF\u09B2\u09C7\u09B0 \u0987\u09A4\u09BF\u09B9\u09BE\u09B8",
    syllabusBTitle: "\u{1F4D6} \u0997\u09CD\u09B0\u09C1\u09AA \u0996 (\u09EC\u09B7\u09CD\u09A0-\u09E7\u09E6\u09AE)",
    syllabusBBody: "\u2022 \u09B8\u09BE\u0993\u09AE\u09C7\u09B0 \u09AE\u09CC\u09B2\u09BF\u0995 \u099C\u09CD\u099E\u09BE\u09A8<br/>\u2022 \u0995\u09C1\u09B0\u0986\u09A8 \u09A8\u09BE\u099C\u09BF\u09B2\u09C7\u09B0 \u0987\u09A4\u09BF\u09B9\u09BE\u09B8<br/>\u2022 \u09AC\u09A6\u09B0 \u09AF\u09C1\u09A6\u09CD\u09A7<br/>\u2022 \u0996\u09A8\u09CD\u09A6\u0995 \u09AF\u09C1\u09A6\u09CD\u09A7",
    contactTitle: "\u{1F4DE} \u09AF\u09CB\u0997\u09BE\u09AF\u09CB\u0997",
    enterBtn: "\u0985\u0982\u09B6\u0997\u09CD\u09B0\u09B9\u09A3 \u0995\u09B0\u09C1\u09A8 \u{1F680}",
    preRegBtn: "\u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09CD\u09B0\u09C7\u09B6\u09A8 \u0995\u09B0\u09C1\u09A8 / Register \u270D\uFE0F",
    msg_before: "\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09A1\u09BE\u0989\u09A8 \u09B6\u09C7\u09B7 \u09B9\u09B2\u09C7 \u0995\u09C1\u0987\u099C \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7\u09A8\u0964",
    msg_live: "\u098F\u0996\u09A8 \u0985\u0982\u09B6\u0997\u09CD\u09B0\u09B9\u09A3 \u0995\u09B0\u09BE \u09AF\u09BE\u09AC\u09C7\u0964 \u09A8\u09BF\u099A\u09C7 \u09B6\u09C7\u09B7 \u09B9\u0993\u09AF\u09BC\u09BE\u09B0 \u0995\u09BE\u0989\u09A8\u09CD\u099F\u09A1\u09BE\u0989\u09A8 \u09A6\u09C7\u0996\u09C1\u09A8\u0964",
    msg_grace: "\u09A8\u09A4\u09C1\u09A8 \u0995\u09C1\u0987\u099C \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09BE \u09AF\u09BE\u09AC\u09C7 \u09A8\u09BE\u0964 \u09AF\u09BE\u09B0\u09BE \u0986\u0997\u09C7 \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09C7\u099B\u09C7 \u09A4\u09BE\u09B0\u09BE \u0995\u09C7\u09AC\u09B2 submit/retry \u0995\u09B0\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7\u0964",
    msg_after: "\u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4 \u09B8\u09AE\u09AF\u09BC \u09B6\u09C7\u09B7 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964",
    schedulePrefix: "\u09B8\u09AE\u09AF\u09BC (Asia/Dhaka): ",
    scheduleMid: " \u09A5\u09C7\u0995\u09C7 "
  },
  en: {
    gateTitle_before: "\u{1F319} Ramadan Genius 2026",
    gateTitle_live: "\u2705 Competition is Live",
    gateTitle_grace: "\u{1F552} Submission Grace Period",
    gateTitle_after: "\u{1F512} Competition Ended",
    salam: "Assalamu Alaikum",
    desc: 'As part of the child development program ahead of the holy month of Ramadan, <strong style="color:var(--accent)">Phulkuri Asor</strong> Dhaka Mahanagari Jhingephul branch is organizing <strong style="color:var(--gold)">"Ramadan Genius 2026"</strong>. This unique event will be held online over 2 days on <strong>March 9\u201310</strong>.',
    rulesTitle: "\u{1F4CB} Rules & Guidelines",
    rules: [
      '<strong>Group A:</strong> Class 3\u20135 &nbsp;|&nbsp; <strong>Group B:</strong> Class 6\u201310',
      '60 MCQ questions, 20 minutes total',
      '20 seconds per question',
      'Once you click Next, you cannot go back to the previous question',
      '0.25 marks deducted per wrong answer (negative marking)',
      'Questions in both Bangla and English',
      'Attractive prizes, certificates & crests',
      'No need to be a Phulkuri member \u2014 all students can participate'
    ],
    syllabusATitle: "\u{1F4D6} Group A (Class 3\u20135)",
    syllabusABody: "\u2022 Basic knowledge of Sawm (Fasting)<br/>\u2022 History of Quran revelation",
    syllabusBTitle: "\u{1F4D6} Group B (Class 6\u201310)",
    syllabusBBody: "\u2022 Basic knowledge of Sawm (Fasting)<br/>\u2022 History of Quran revelation<br/>\u2022 Battle of Badr<br/>\u2022 Battle of Khandaq",
    contactTitle: "\u{1F4DE} Contact",
    enterBtn: "Enter Quiz \u{1F680}",
    preRegBtn: "Register \u270D\uFE0F",
    msg_before: "Quiz starts when the countdown reaches zero.",
    msg_live: "The competition is live now. See the countdown below.",
    msg_grace: "No new quiz starts. Only previously started participants may submit/retry.",
    msg_after: "The competition window is closed.",
    schedulePrefix: "Time (Asia/Dhaka): ",
    scheduleMid: " to "
  }
};

function applyLang(lang) {
  currentLang = lang;
  const t = i18n[lang];
  const sw = $("langSwitch");

  if (lang === "en") {
    sw.classList.add("en");
    $("langLabelEn").classList.add("active");
    $("langLabelBn").classList.remove("active");
  } else {
    sw.classList.remove("en");
    $("langLabelBn").classList.add("active");
    $("langLabelEn").classList.remove("active");
  }

  // Salam
  $("landingSalam").innerText = t.salam;
  // Description
  $("landingDesc").innerHTML = t.desc;
  // Rules title
  $("rulesTitle").innerHTML = t.rulesTitle;
  // Rules list
  const ul = $("rulesList");
  ul.innerHTML = "";
  t.rules.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = r;
    ul.appendChild(li);
  });
  // Syllabus
  $("syllabusATitle").innerHTML = t.syllabusATitle;
  $("syllabusABody").innerHTML = t.syllabusABody;
  $("syllabusBTitle").innerHTML = t.syllabusBTitle;
  $("syllabusBBody").innerHTML = t.syllabusBBody;
  // Contact
  $("contactTitle").innerHTML = t.contactTitle;
  // Enter button
  $("enterBtn").innerText = t.enterBtn;
  // Pre-registration button
  if ($("preRegBtn")) $("preRegBtn").innerText = t.preRegBtn;

  // Re-render gate to update phase-dependent text
  renderGate();
}

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
  if (currentLang === "en") {
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hms}`;
    return hms;
  }
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
  const t = i18n[currentLang];

  // Show schedule
  $("gateSchedule").innerHTML =
    `${t.schedulePrefix}${formatDhakaDate(CONTEST_START_MS)}${t.scheduleMid}${formatDhakaDate(CONTEST_END_MS)}`;

  const landing = $("landingContent");

  if (phase === "before") {
    $("gateTitle").innerText = t.gateTitle_before;
    $("gateMessage").innerHTML = t.msg_before;
    $("gateCountdown").innerText = formatCountdown(CONTEST_START_MS - now);
    if (landing) landing.style.display = "";
    hide("enterBtn");
    // Show pre-registration button before contest
    if ($("preRegBtn")) {
      $("preRegBtn").innerText = t.preRegBtn;
      show("preRegBtn");
    }
    return;
  }

  // Keep landing content visible in all phases
  if (landing) landing.style.display = "";

  if (phase === "after") {
    $("gateTitle").innerText = t.gateTitle_after;
    $("gateMessage").innerHTML = t.msg_after;
    $("gateCountdown").innerText = currentLang === "en" ? "00:00:00" : "\u09E6\u09E6:\u09E6\u09E6:\u09E6\u09E6";
    hide("enterBtn");
    if ($("preRegBtn")) hide("preRegBtn");
    return;
  }

  if (phase === "grace") {
    $("gateTitle").innerText = t.gateTitle_grace;
    $("gateMessage").innerHTML = t.msg_grace;
    $("gateCountdown").innerText = formatCountdown(CONTEST_GRACE_END_MS - now);
    hide("enterBtn");
    if ($("preRegBtn")) hide("preRegBtn");
    return;
  }

  $("gateTitle").innerText = t.gateTitle_live;
  $("gateMessage").innerHTML = t.msg_live;
  $("gateCountdown").innerText = formatCountdown(CONTEST_END_MS - now);
  $("enterBtn").innerText = t.enterBtn;
  show("enterBtn");
  if ($("preRegBtn")) hide("preRegBtn");
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

  // Calculate how many questions were missed while user was away
  const now = Date.now();
  if (now >= state.questionEndsAt) {
    // Time past the last known deadline
    const overflowMs = now - state.questionEndsAt;
    // 1 for the question that expired + however many full 20s windows passed after
    const missedQuestions = 1 + Math.floor(overflowMs / (SECONDS_PER_QUESTION * 1000));
    state.currentIndex += missedQuestions;

    if (state.currentIndex >= state.quiz.length) {
      finishQuiz();
      return true;
    }

    // Set deadline for the current question (partial time remaining in this window)
    const partialMs = overflowMs % (SECONDS_PER_QUESTION * 1000);
    state.questionEndsAt = now + (SECONDS_PER_QUESTION * 1000 - partialMs);
    saveState();
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
    const iframe = $("hiddenFrame");

    // Clear any previous handler
    iframe.onload = null;

    $("secretField").value = SECRET;
    $("payloadField").value = JSON.stringify(payload);
    form.action = getNextEndpoint();

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


// ====== PRE-REGISTRATION ======
let regSubmitting = false;  // guard against double-clicks

function showPreRegForm() {
  hide("gateCard");
  show("preRegCard");
  $("regError").innerText = "";
  $("regSuccess").style.display = "none";
  $("regSubmitBtn").disabled = false;
}

function hidePreRegForm() {
  hide("preRegCard");
  show("gateCard");
}

function resetRegForm() {
  // Clear all fields for next registration
  const inputs = document.querySelectorAll("#preRegCard input, #preRegCard select");
  inputs.forEach(inp => {
    if (inp.tagName === "SELECT") inp.selectedIndex = 0;
    else inp.value = "";
  });
  $("regError").innerText = "";
  $("regSuccess").style.display = "none";
  $("regSubmitBtn").disabled = false;
  $("regSubmitBtn").innerText = "\u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09CD\u09B0\u09C7\u09B6\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u0995\u09B0\u09C1\u09A8 / Submit Registration \u2705";
}

async function submitRegistration() {
  // Prevent double-clicks
  if (regSubmitting) return;

  const name = ($("rName").value || "").trim();
  const phone = ($("rPhone").value || "").trim();

  if (!name) { $("regError").innerText = "\u09A8\u09BE\u09AE \u09B2\u09BF\u0996\u09C1\u09A8 / Please enter your name."; return; }
  if (!phone) { $("regError").innerText = "\u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09B2\u09BF\u0996\u09C1\u09A8 / Please enter phone number."; return; }

  regSubmitting = true;
  $("regError").innerText = "";
  $("regSubmitBtn").disabled = true;
  $("regSubmitBtn").innerText = "Submitting...";

  const payload = {
    type: "registration",
    name: name,
    fatherName: ($("rFatherName").value || "").trim(),
    fatherProf: ($("rFatherProf").value || "").trim(),
    motherName: ($("rMotherName").value || "").trim(),
    motherProf: ($("rMotherProf").value || "").trim(),
    dob: ($("rDob").value || "").trim(),
    bloodGroup: ($("rBlood").value || "").trim(),
    institution: ($("rInstitution").value || "").trim(),
    class: ($("rClass").value || "").trim(),
    section: ($("rSection").value || "").trim(),
    rollNo: ($("rRoll").value || "").trim(),
    presentAddress: ($("rPresentAddr").value || "").trim(),
    permanentAddress: ($("rPermAddr").value || "").trim(),
    phone: phone,
    email: ($("rEmail").value || "").trim(),
    facebook: ($("rFacebook").value || "").trim()
  };

  // Submit via hidden form (with iframe reset for reliability)
  const ok = await submitRegToSheet(payload);

  regSubmitting = false;

  if (ok) {
    $("regSubmitBtn").disabled = true;
    $("regSubmitBtn").innerText = "\u2705 Submitted";
    $("regSuccess").innerHTML =
      "\u2705 \u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09CD\u09B0\u09C7\u09B6\u09A8 \u09B8\u09AB\u09B2! \u09AA\u09CD\u09B0\u09A4\u09BF\u09AF\u09CB\u0997\u09BF\u09A4\u09BE \u09B6\u09C1\u09B0\u09C1 \u09B9\u09B2\u09C7 \u098F\u0987 \u09AA\u09C7\u0987\u099C\u09C7 \u098F\u09B8\u09C7 \u0995\u09C1\u0987\u099C \u09A6\u09BF\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7\u09A8\u0964<br/>Registration successful! Come back when the contest starts.";
    $("regSuccess").style.display = "";
    // Show "Register Another" button after 2 seconds
    setTimeout(() => {
      if ($("regAnotherBtn")) $("regAnotherBtn").style.display = "";
    }, 2000);
  } else {
    $("regSubmitBtn").disabled = false;
    $("regSubmitBtn").innerText = "\u09B0\u09C7\u099C\u09BF\u09B8\u09CD\u099F\u09CD\u09B0\u09C7\u09B6\u09A8 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u0995\u09B0\u09C1\u09A8 / Submit Registration \u2705";
    $("regError").innerText = "\u09B8\u09BE\u09AC\u09AE\u09BF\u099F \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5\u0964 \u0986\u09AC\u09BE\u09B0 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8\u0964 / Submission failed. Please try again.";
  }
}

function submitRegToSheet(payload) {
  return new Promise((resolve) => {
    const form = $("submitForm");
    const iframe = $("hiddenFrame");

    // Clear any previous handler
    iframe.onload = null;

    $("secretField").value = SECRET;
    $("payloadField").value = JSON.stringify(payload);
    form.action = getNextEndpoint();

    let done = false;

    iframe.onload = () => {
      if (done) return;
      done = true;
      resolve(true);
    };

    form.submit();

    // Timeout fallback: form POST fires even if onload is unreliable
    setTimeout(() => {
      if (done) return;
      done = true;
      resolve(true);  // Assume success: data was POSTed
    }, 8000);
  });
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

  // Language toggle
  $("langSwitch").addEventListener("click", () => {
    applyLang(currentLang === "bn" ? "en" : "bn");
  });

  $("enterBtn").addEventListener("click", enterQuizFromGate);
  if ($("preRegBtn")) $("preRegBtn").addEventListener("click", showPreRegForm);
  if ($("regBackBtn")) $("regBackBtn").addEventListener("click", hidePreRegForm);
  if ($("regSubmitBtn")) $("regSubmitBtn").addEventListener("click", submitRegistration);
  if ($("regAnotherBtn")) $("regAnotherBtn").addEventListener("click", () => {
    $("regAnotherBtn").style.display = "none";
    resetRegForm();
  });
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
