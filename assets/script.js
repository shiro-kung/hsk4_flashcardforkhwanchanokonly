const card = document.getElementById("card");
const frontWord = document.getElementById("frontWord");
const backPinyin = document.getElementById("backPinyin");
const backMeaning = document.getElementById("backMeaning");
const progress = document.getElementById("progress");
const wordList = document.getElementById("wordList");

let index = 0;
let flipped = false;
let advanceLock = false;
let advanceTimer = null;

const STORAGE_KEY = `hsk_flash_stats_${location.pathname.replace(/[^a-z0-9]/gi, "_")}`;

let stats = {
  score: 0,
  correct: 0,
  wrong: 0,
  streak: 0,
  maxStreak: 0,
};

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    stats = {
      score: Number(parsed.score) || 0,
      correct: Number(parsed.correct) || 0,
      wrong: Number(parsed.wrong) || 0,
      streak: 0,
      maxStreak: Number(parsed.maxStreak) || 0,
    };
  } catch {
    /* ignore */
  }
}

function saveStats() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        score: stats.score,
        correct: stats.correct,
        wrong: stats.wrong,
        maxStreak: stats.maxStreak,
      })
    );
  } catch {
    /* ignore */
  }
}

function accuracyPct() {
  const t = stats.correct + stats.wrong;
  if (!t) return null;
  return Math.round((stats.correct / t) * 100);
}

function updateScoreBar() {
  const bar = document.getElementById("scoreBar");
  if (!bar) return;
  const acc = accuracyPct();
  bar.querySelector("[data-score]").textContent = stats.score.toLocaleString("th-TH");
  bar.querySelector("[data-correct]").textContent = stats.correct.toLocaleString("th-TH");
  bar.querySelector("[data-wrong]").textContent = stats.wrong.toLocaleString("th-TH");
  bar.querySelector("[data-streak]").textContent = stats.streak.toLocaleString("th-TH");
  bar.querySelector("[data-max-streak]").textContent = stats.maxStreak.toLocaleString("th-TH");
  const accEl = bar.querySelector("[data-accuracy]");
  accEl.textContent = acc === null ? "—" : `${acc}%`;
}

function injectScoreUI() {
  const topbar = document.querySelector(".topbar");
  if (!topbar || document.getElementById("scoreBar")) return;

  const wrap = document.createElement("div");
  wrap.className = "score-wrap";
  wrap.id = "scoreBar";
  wrap.innerHTML = `
    <div class="score-chips">
      <div class="chip chip-score" title="คะแนนสะสมในชุดนี้">
        <span class="chip-label">คะแนน</span>
        <span class="chip-value" data-score>0</span>
      </div>
      <div class="chip chip-good">
        <span class="chip-label">จำได้</span>
        <span class="chip-value" data-correct>0</span>
      </div>
      <div class="chip chip-bad">
        <span class="chip-label">ยังไม่แม่น</span>
        <span class="chip-value" data-wrong>0</span>
      </div>
      <div class="chip chip-streak">
        <span class="chip-label">สตรีค</span>
        <span class="chip-value"><span data-streak>0</span><span class="chip-sub">สูงสุด <span data-max-streak>0</span></span></span>
      </div>
      <div class="chip chip-acc">
        <span class="chip-label">ความแม่นยำ</span>
        <span class="chip-value" data-accuracy>—</span>
      </div>
    </div>
    <p class="score-hint">นับคะแนน<strong>ข้อละ 1 คะแนน</strong>เมื่อกด <strong>ถัดไป</strong> / จำได้ • <strong>ถัดไป</strong> / <kbd>→</kbd> = จำได้แล้ว: ถ้ายังเป็นหน้าคำจีน ระบบจะพลิกให้เห็นพินอินก่อน แล้วไปคำถัดไป • <kbd>Space</kbd> พลิกเอง • <kbd>←</kbd> ก่อนหน้า (ไม่นับคะแนน) • <kbd>K</kbd> เหมือนถัดไป • <kbd>J</kbd> ยังไม่แม่น</p>
  `;
  topbar.after(wrap);

  const controls = document.querySelector(".controls");
  if (controls) {
    const row = document.createElement("div");
    row.className = "score-actions";
    row.innerHTML = `
      <button type="button" class="btn btn-know" id="btnKnow" title="เหมือนปุ่ม ถัดไป — ข้อละ 1 คะแนน">จำได้ (+1)</button>
      <button type="button" class="btn btn-unsure" id="btnUnsure">ยังไม่แม่น</button>
    `;
    controls.before(row);

    document.getElementById("btnKnow").addEventListener("click", markKnown);
    document.getElementById("btnUnsure").addEventListener("click", markUnsure);

    if (!document.getElementById("btnResetScoreMain")) {
      const resetMain = document.createElement("button");
      resetMain.type = "button";
      resetMain.className = "btn btn-reset";
      resetMain.id = "btnResetScoreMain";
      resetMain.textContent = "รีเซ็ตคะแนน";
      resetMain.title = "ล้างคะแนน จำได้/ยังไม่แม่น สตรีค และความแม่นยำของชุดนี้";
      resetMain.addEventListener("click", resetStats);
      controls.appendChild(resetMain);
    }
  }
}

function clearAdvanceTimer() {
  if (advanceTimer !== null) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }
}

/** ถัดไป / จำได้: นับคะแนน ถ้ายังไม่พลิกจะพลิกให้เห็นคำตอบก่อน แล้วไปคำถัดไป */
function advanceAsKnown() {
  if (advanceLock) return;
  advanceLock = true;

  stats.score += 1;
  stats.correct += 1;
  stats.streak += 1;
  if (stats.streak > stats.maxStreak) stats.maxStreak = stats.streak;
  saveStats();
  updateScoreBar();
  pulseCard("pulse-good");

  const goNext = () => {
    advanceTimer = null;
    index = (index + 1) % words.length;
    flipped = false;
    advanceLock = false;
    renderCard();
  };

  clearAdvanceTimer();
  if (!flipped) {
    flipped = true;
    renderCard();
    advanceTimer = setTimeout(goNext, 480);
  } else {
    advanceTimer = setTimeout(goNext, 220);
  }
}

function markKnown() {
  advanceAsKnown();
}

function goToNextCardPlain() {
  index = (index + 1) % words.length;
  flipped = false;
  renderCard();
}

function markUnsure() {
  if (advanceLock) return;
  stats.wrong += 1;
  stats.streak = 0;
  saveStats();
  updateScoreBar();
  pulseCard("pulse-warn");
  setTimeout(() => {
    goToNextCardPlain();
  }, 220);
}

function pulseCard(cls) {
  card.classList.add(cls);
  setTimeout(() => card.classList.remove(cls), 400);
}

function resetStats() {
  if (!confirm("รีเซ็ตคะแนนและสถิติของชุดนี้ทั้งหมด?")) return;
  clearAdvanceTimer();
  advanceLock = false;
  stats = { score: 0, correct: 0, wrong: 0, streak: 0, maxStreak: 0 };
  localStorage.removeItem(STORAGE_KEY);
  saveStats();
  updateScoreBar();
}

function renderCard() {
  const w = words[index];
  card.classList.toggle("flipped", flipped);
  frontWord.textContent = w.word;
  backPinyin.textContent = w.pinyin;
  backMeaning.textContent = w.meaning;
  progress.textContent = `การ์ดที่ ${index + 1} / ${words.length}`;
  updateScoreBar();
}

function flipCard() {
  if (advanceLock) return;
  flipped = !flipped;
  renderCard();
}

function nextCard() {
  advanceAsKnown();
}

function prevCard() {
  if (advanceLock) return;
  index = (index - 1 + words.length) % words.length;
  flipped = false;
  renderCard();
}

function shuffleCards() {
  clearAdvanceTimer();
  advanceLock = false;
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  index = 0;
  flipped = false;
  renderCard();
  renderList();
}

function toggleList() {
  wordList.classList.toggle("hidden");
}

function renderList() {
  wordList.innerHTML = `<div class="table-scroll"><table><thead><tr><th>#</th><th>จีน</th><th>พินอิน</th><th>ไทย</th></tr></thead><tbody>${words
    .map(
      (w, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(w.word)}</td><td>${escapeHtml(w.pinyin)}</td><td>${escapeHtml(w.meaning)}</td></tr>`
    )
    .join("")}</tbody></table></div>`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  if (e.key === "ArrowRight") advanceAsKnown();
  if (e.key === "ArrowLeft") prevCard();
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    flipCard();
  }
  const k = e.key.toLowerCase();
  if (k === "k" || k === "y") advanceAsKnown();
  if (k === "j" || k === "n") markUnsure();
});

loadStats();
injectScoreUI();
renderCard();
renderList();
updateScoreBar();
