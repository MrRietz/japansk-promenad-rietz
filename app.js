/* =============================================================
 *  Japansk Promenad – frontend-logik
 *  Läser/skriver promenader via Google Apps Script (API_URL i config.js).
 *  Faller tillbaka till localStorage (demo-läge) om ingen URL är satt.
 * ============================================================= */

const FALLBACK_TASK =
  'Japansk promenad 4 gr/v. Gå raskt i 3 minuter – så att du blir andfådd men ' +
  'fortfarande kan prata i korta meningar. Gå sedan lugnt i 3 minuter och hämta andan. ' +
  'Upprepa fem gånger. Då har du fyllt 30 minuter.';

const PERSON_COLORS = { Robin: 'robin', Elisabeth: 'elisabeth' };
const WEEKLY_GOAL = 4; // 4 gr/v enligt uppgiften

const MONTHS = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];

const state = {
  task: FALLBACK_TASK,
  people: ['Robin', 'Elisabeth'],
  entries: {},                 // { "YYYY-MM-DD": { Robin: bool, Elisabeth: bool } }
  viewYear: 0,
  viewMonth: 0,
  selectedDate: null,
};

// API_URL deklareras i config.js (som `const`, så den blir inte en window-egenskap –
// därför refererar vi den direkt). typeof-vakten gör att koden inte kraschar om
// config.js skulle saknas.
const apiUrl = (typeof API_URL !== 'undefined' && API_URL) ? API_URL.trim() : '';
const demoMode = apiUrl === '';

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  taskText: $('taskText'),
  monthLabel: $('monthLabel'),
  grid: $('calendarGrid'),
  stats: $('stats'),
  legend: $('legend'),
  status: $('status'),
  modal: $('modal'),
  modalDate: $('modalDate'),
  personToggles: $('personToggles'),
};

/* ---------- Datumhjälpare ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function isoOf(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function todayIso() {
  const t = new Date();
  return isoOf(t.getFullYear(), t.getMonth(), t.getDate());
}

/* ---------- Status-text ---------- */
function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.className = 'status' + (kind ? ' ' + kind : '');
}

/* ===========================================================
 *  Datalager – API eller localStorage
 * =========================================================== */
const STORE_KEY = 'japansk-promenad-demo';

function loadDemo() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    state.entries = raw ? JSON.parse(raw) : {};
  } catch { state.entries = {}; }
  state.task = FALLBACK_TASK;
}
function saveDemo() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.entries));
}

async function fetchData() {
  if (demoMode) {
    loadDemo();
    setStatus('Demo-läge (sparas lokalt)', 'ok');
    return;
  }
  setStatus('Laddar…');
  const res = await fetch(apiUrl, { method: 'GET' });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Fel vid hämtning');
  state.task = data.task || FALLBACK_TASK;
  if (Array.isArray(data.people) && data.people.length) state.people = data.people;
  state.entries = data.entries || {};
  setStatus('Synkad med Google Sheet', 'ok');
}

async function saveEntry(date, person, done) {
  // Anroparen (togglePerson) har redan uppdaterat state optimistiskt.
  if (demoMode) {
    saveDemo();
    return;
  }

  // Apps Script web-apps tål inte custom headers (CORS preflight).
  // text/plain undviker preflight men levererar ändå JSON-strängen.
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ date, person, done }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Kunde inte spara');
  // Medvetet INGEN omskrivning av state.entries här – den optimistiska
  // uppdateringen ovan räcker, och att ersätta hela objektet skulle tvinga
  // en extra omritning som syns som lagg.
}

/* ===========================================================
 *  Rendering
 * =========================================================== */
function render() {
  els.taskText.textContent = state.task;
  renderLegend();
  renderStats();
  renderCalendar();
}

function renderLegend() {
  els.legend.innerHTML = state.people.map((p) => `
    <span class="item">
      <span class="swatch" style="background: var(--${PERSON_COLORS[p] || 'robin'})"></span>${p}
    </span>`).join('');
}

function renderStats() {
  // Räkna promenader för innevarande vecka (mån–sön) per person.
  const { weekStart, weekEnd } = currentWeekRange();
  els.stats.innerHTML = state.people.map((p) => {
    const colorVar = PERSON_COLORS[p] || 'robin';
    let count = 0;
    for (const [date, rec] of Object.entries(state.entries)) {
      if (rec[p] && date >= weekStart && date <= weekEnd) count++;
    }
    const pct = Math.min(100, Math.round((count / WEEKLY_GOAL) * 100));
    return `
      <div class="stat">
        <div class="who"><span class="dot" style="background:var(--${colorVar})"></span>${p}</div>
        <div class="big">${count}<span class="goal"> / ${WEEKLY_GOAL} denna vecka</span></div>
        <div class="bar"><i style="width:${pct}%;background:var(--${colorVar})"></i></div>
      </div>`;
  }).join('');
}

function currentWeekRange() {
  const t = new Date();
  const day = (t.getDay() + 6) % 7; // 0 = måndag
  const monday = new Date(t); monday.setDate(t.getDate() - day);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: isoOf(monday.getFullYear(), monday.getMonth(), monday.getDate()),
    weekEnd: isoOf(sunday.getFullYear(), sunday.getMonth(), sunday.getDate()),
  };
}

function renderCalendar() {
  const y = state.viewYear, m = state.viewMonth;
  els.monthLabel.textContent = `${MONTHS[m]} ${y}`;

  const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // mån=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayIso();

  let html = '';
  for (let i = 0; i < firstWeekday; i++) html += '<div class="day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = isoOf(y, m, d);
    const rec = state.entries[iso] || {};
    const robin = !!rec.Robin, elisabeth = !!rec.Elisabeth;
    const both = robin && elisabeth;

    const pips = state.people.map((p) => {
      const on = !!rec[p];
      const cls = on ? PERSON_COLORS[p] || 'robin' : '';
      return `<span class="pip ${cls}"></span>`;
    }).join('');

    const classes = ['day'];
    if (iso === today) classes.push('today');
    if (both) classes.push('both');

    html += `
      <div class="${classes.join(' ')}" data-date="${iso}">
        <span class="num">${d}</span>
        <span class="pips">${pips}</span>
      </div>`;
  }
  els.grid.innerHTML = html;

  els.grid.querySelectorAll('.day[data-date]').forEach((el) => {
    el.addEventListener('click', () => openModal(el.dataset.date));
  });
}

/* ===========================================================
 *  Modal – bocka av promenad
 * =========================================================== */
function openModal(iso) {
  state.selectedDate = iso;
  const [y, m, d] = iso.split('-').map(Number);
  els.modalDate.textContent = `${d} ${MONTHS[m - 1]} ${y}`;

  const rec = state.entries[iso] || {};
  els.personToggles.innerHTML = state.people.map((p) => {
    const on = !!rec[p];
    const colorVar = PERSON_COLORS[p] || 'robin';
    return `
      <div class="toggle ${on ? 'on' : ''}" data-person="${p}">
        <span class="name"><span class="dot" style="background:var(--${colorVar})"></span>${p}</span>
        <span class="check">✓</span>
      </div>`;
  }).join('');

  els.personToggles.querySelectorAll('.toggle').forEach((t) => {
    t.addEventListener('click', () => togglePerson(t));
  });

  els.modal.hidden = false;
}

function closeModal() {
  els.modal.hidden = true;
  state.selectedDate = null;
}

function togglePerson(toggleEl) {
  const person = toggleEl.dataset.person;
  const iso = state.selectedDate;
  const willBeOn = !toggleEl.classList.contains('on');

  // 1) Uppdatera allt direkt – ingen väntan på nätet.
  if (!state.entries[iso]) state.entries[iso] = {};
  state.entries[iso][person] = willBeOn;
  toggleEl.classList.toggle('on', willBeOn);
  renderStats();
  renderCalendar();

  // 2) Stäng popupen med en gång.
  closeModal();

  // 3) Spara i bakgrunden. Rulla tillbaka bara om det faktiskt misslyckas.
  setStatus(demoMode ? 'Sparar lokalt…' : 'Sparar…');
  saveEntry(iso, person, willBeOn)
    .then(() => setStatus(demoMode ? 'Sparat lokalt' : 'Sparat i Google Sheet', 'ok'))
    .catch((err) => {
      setStatus('Kunde inte spara – försök igen', 'err');
      if (state.entries[iso]) state.entries[iso][person] = !willBeOn;
      renderStats();
      renderCalendar();
    });
}

/* ===========================================================
 *  Navigering & init
 * =========================================================== */
function changeMonth(delta) {
  let m = state.viewMonth + delta;
  let y = state.viewYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  state.viewMonth = m; state.viewYear = y;
  renderCalendar();
}

function bindUi() {
  $('prevMonth').addEventListener('click', () => changeMonth(-1));
  $('nextMonth').addEventListener('click', () => changeMonth(1));
  $('modalClose').addEventListener('click', closeModal);
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('refreshBtn').addEventListener('click', init);
}

async function init() {
  const now = new Date();
  state.viewYear = now.getFullYear();
  state.viewMonth = now.getMonth();
  try {
    await fetchData();
  } catch (err) {
    setStatus('Kunde inte ansluta: ' + err.message, 'err');
    loadDemo();
  }
  render();
}

bindUi();
init();
