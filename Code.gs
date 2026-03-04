// ============================================================
//  Ramadan Genius — Google Apps Script Backend
//  Paste into: Google Sheet -> Extensions -> Apps Script
// ============================================================

// ========= CONFIG =========
const SHEET_NAME = "Responses";
const SECRET = "rg2026_phulkuri_secretKey99";

// Server-side contest window (Asia/Dhaka)
// ORIGINAL (restore after testing):
// const CONTEST_START = new Date("2026-03-07T10:00:00+06:00");
// TEMPORARY TEST MODE:
const CONTEST_START = new Date("2026-03-05T00:00:00+06:00");
const CONTEST_END = new Date("2026-03-08T10:00:00+06:00");
const SUBMISSION_GRACE_MINUTES = 30;
const CONTEST_GRACE_END = new Date(CONTEST_END.getTime() + SUBMISSION_GRACE_MINUTES * 60 * 1000);

// ========= ANSWER KEYS =========
// Keep answer keys on server only.
const ANSWER_KEY_A = {
  "a01": "B",
  "a02": "B",
  "a03": "C",
  "a04": "B",
  "a05": "C",
  "a06": "B",
  "a07": "B",
  "a08": "B",
  "a09": "B",
  "a10": "A",
  "a11": "B",
  "a12": "C",
  "a13": "B",
  "a14": "C",
  "a15": "C",
  "a16": "B",
  "a17": "B",
  "a18": "B",
  "a19": "B",
  "a20": "C",
  "a21": "B",
  "a22": "C",
  "a23": "A",
  "a24": "C",
  "a25": "B",
  "a26": "B",
  "a27": "C",
  "a28": "A",
  "a29": "A",
  "a30": "D",
  "a31": "C",
  "a32": "C",
  "a33": "B",
  "a34": "B",
  "a35": "B",
  "a36": "B",
  "a37": "B",
  "a38": "C",
  "a39": "B",
  "a40": "C",
  "a41": "A",
  "a42": "B",
  "a43": "C",
  "a44": "C",
  "a45": "B",
  "a46": "C",
  "a47": "A",
  "a48": "C",
  "a49": "A",
  "a50": "B",
  "a51": "B",
  "a52": "B",
  "a53": "C",
  "a54": "B",
  "a55": "C",
  "a56": "B",
  "a57": "B",
  "a58": "A",
  "a59": "A",
  "a60": "B"
};

const ANSWER_KEY_B = {
  "b01": "B",
  "b02": "A",
  "b03": "B",
  "b04": "B",
  "b05": "B",
  "b06": "B",
  "b07": "B",
  "b08": "B",
  "b09": "B",
  "b10": "C",
  "b11": "A",
  "b12": "B",
  "b13": "B",
  "b14": "B",
  "b15": "B",
  "b16": "C",
  "b17": "A",
  "b18": "B",
  "b19": "B",
  "b20": "B",
  "b21": "C",
  "b22": "B",
  "b23": "A",
  "b24": "B",
  "b25": "A",
  "b26": "A",
  "b27": "A",
  "b28": "A",
  "b29": "C",
  "b30": "B",
  "b31": "B",
  "b32": "B",
  "b33": "B",
  "b34": "C",
  "b35": "A",
  "b36": "B",
  "b37": "B",
  "b38": "A",
  "b39": "B",
  "b40": "B",
  "b41": "A",
  "b42": "B",
  "b43": "B",
  "b44": "A",
  "b45": "A",
  "b46": "B",
  "b47": "A",
  "b48": "A",
  "b49": "B",
  "b50": "B",
  "b51": "B",
  "b52": "B",
  "b53": "B",
  "b54": "A",
  "b55": "B",
  "b56": "B",
  "b57": "B",
  "b58": "A",
  "b59": "B",
  "b60": "B"
};

// ========= HELPERS =========
function jsonText(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error("Sheet not found: " + SHEET_NAME);
  return sh;
}

function scoreAnswers_(answersArray, category) {
  const key = category === "B" ? ANSWER_KEY_B : ANSWER_KEY_A;
  let score = 0;

  for (const item of answersArray || []) {
    const correct = key[item.qid];
    if (correct && item.a === correct) score++;
  }

  return score;
}

// ========= WEB APP =========
function doGet() {
  return jsonText({
    ok: true,
    message: "Ramadan Genius collector is running.",
    contestStart: CONTEST_START.toISOString(),
    contestEnd: CONTEST_END.toISOString(),
    graceEnd: CONTEST_GRACE_END.toISOString()
  });
}

function doPost(e) {
  try {
    const now = new Date();

    if (now < CONTEST_START) {
      return jsonText({ ok: false, error: "প্রতিযোগিতা এখনও শুরু হয়নি। / Contest has not started yet." });
    }
    if (now > CONTEST_GRACE_END) {
      return jsonText({ ok: false, error: "প্রতিযোগিতা শেষ হয়েছে। Submission grace window-ও শেষ। / Contest and grace window have ended." });
    }

    const params = e && e.parameter ? e.parameter : {};

    if (params.secret !== SECRET) {
      return jsonText({ ok: false, error: "Unauthorized." });
    }

    if (!params.payload) {
      return jsonText({ ok: false, error: "Missing payload." });
    }

    const payload = JSON.parse(params.payload);

    const name = String(payload.name || "").trim().slice(0, 80);
    const cls = String(payload["class"] || "").trim().slice(0, 20);
    const phone = String(payload.phone || "").trim().slice(0, 20);
    const school = String(payload.school || "").trim().slice(0, 120);
    const address = String(payload.address || "").trim().slice(0, 200);
    const father = String(payload.father || "").trim().slice(0, 80);
    const mother = String(payload.mother || "").trim().slice(0, 80);
    const category = String(payload.category || "").trim().slice(0, 5);
    const sessionId = String(payload.sessionId || "").trim().slice(0, 80);
    const userAgent = String(payload.userAgent || "").slice(0, 250);

    const startedAtClient = String(payload.startedAtClient || "");
    const finishedAtClient = String(payload.finishedAtClient || "");
    const durationSecClient = Number(payload.durationSecClient || 0);

    // Grace rule: after official end time, allow only participants who started on/before end time.
    if (now > CONTEST_END) {
      if (!startedAtClient) {
        return jsonText({ ok: false, error: "Grace mode requires a valid start time." });
      }

      const startedAtDate = new Date(startedAtClient);
      if (isNaN(startedAtDate.getTime())) {
        return jsonText({ ok: false, error: "Invalid startedAtClient format." });
      }

      if (startedAtDate > CONTEST_END) {
        return jsonText({ ok: false, error: "New quiz attempts are not allowed after contest end." });
      }
    }

    if (!name || !cls || !phone || !school) {
      return jsonText({ ok: false, error: "Name, Class, Phone, and School are required." });
    }

    if (category !== "A" && category !== "B") {
      return jsonText({ ok: false, error: "Invalid category." });
    }

    const answers = payload.answers || [];
    const score = scoreAnswers_(answers, category);

    const flags = [];
    if (durationSecClient <= 0) flags.push("no_duration");
    else if (durationSecClient > 60 * 30) flags.push("too_long");
    if (now > CONTEST_END) flags.push("submitted_in_grace");
    const flag = flags.join(",");

    const sh = getSheet_();
    sh.appendRow([
      now.toISOString(),
      name,
      cls,
      phone,
      school,
      address,
      father,
      mother,
      category,
      sessionId,
      startedAtClient,
      finishedAtClient,
      durationSecClient,
      score,
      JSON.stringify(answers),
      userAgent,
      flag
    ]);

    return jsonText({ ok: true, score: score });
  } catch (err) {
    return jsonText({ ok: false, error: String(err) });
  }
}
