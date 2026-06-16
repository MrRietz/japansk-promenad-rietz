/**
 * Google Apps Script – API för Japansk Promenad
 * =================================================
 * Detta skript kopplas till Google Sheet:t och publiceras som en web-app.
 * Hemsidan (GitHub Pages) läser OCH skriver promenader via detta API.
 *
 * Arkets struktur (rad 1 = rubriker):
 *   A: Datum   |  B: Robin  |  C: Elisabeth
 *   Rad 2 innehåller uppgiftsbeskrivningen (lämnas orörd).
 *   Promenadposter skrivs från rad 3 och nedåt.
 *
 * Se README.md för hur du installerar och publicerar detta.
 */

// Namnet på fliken som datan ligger i. Byt om din flik heter något annat.
const SHEET_NAME = 'Blad1';

// Rad där uppgiftsbeskrivningen ligger (kolumn A). Promenaddata börjar raden efter.
const TASK_ROW = 2;
const DATA_START_ROW = 3;

// Personernas kolumner (1-indexerat). A=1, B=2, C=3.
const COL_DATE = 1;
const PEOPLE = { Robin: 2, Elisabeth: 3 };

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.getSheets()[0]; // fallback: första fliken
  return sheet;
}

/** Hämtar uppgiftstexten ur cell A2. */
function getTask_(sheet) {
  return String(sheet.getRange(TASK_ROW, COL_DATE).getValue() || '').trim();
}

/** Normaliserar ett datum till "YYYY-MM-DD" oavsett om det är ett Date-objekt eller text. */
function normalizeDate_(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value || '').trim();
}

/** Läser alla promenadposter och returnerar dem som ett objekt per datum. */
function readEntries_(sheet) {
  const lastRow = sheet.getLastRow();
  const entries = {};
  if (lastRow < DATA_START_ROW) return entries;

  const numRows = lastRow - DATA_START_ROW + 1;
  const values = sheet.getRange(DATA_START_ROW, COL_DATE, numRows, 3).getValues();

  values.forEach((row) => {
    const date = normalizeDate_(row[0]);
    if (!date) return;
    entries[date] = {
      Robin: !!row[1],
      Elisabeth: !!row[2],
    };
  });
  return entries;
}

/** Hittar radnumret för ett visst datum, eller 0 om det inte finns. */
function findRowForDate_(sheet, date) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return 0;
  const numRows = lastRow - DATA_START_ROW + 1;
  const dates = sheet.getRange(DATA_START_ROW, COL_DATE, numRows, 1).getValues();
  for (let i = 0; i < dates.length; i++) {
    if (normalizeDate_(dates[i][0]) === date) return DATA_START_ROW + i;
  }
  return 0;
}

/** GET: returnerar uppgift + alla poster som JSON. */
function doGet() {
  const sheet = getSheet_();
  const payload = {
    ok: true,
    task: getTask_(sheet),
    people: Object.keys(PEOPLE),
    entries: readEntries_(sheet),
  };
  return jsonResponse_(payload);
}

/**
 * POST: sätter promenad-status för en person på ett datum.
 * Body (JSON): { date: "YYYY-MM-DD", person: "Robin", done: true }
 * Skapar en ny rad om datumet inte finns.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // undvik samtidiga skrivningar
  try {
    const body = JSON.parse(e.postData.contents);
    const date = normalizeDate_(body.date);
    const person = body.person;
    const done = !!body.done;

    if (!date) return jsonResponse_({ ok: false, error: 'Saknar datum' });
    if (!(person in PEOPLE)) return jsonResponse_({ ok: false, error: 'Okänd person: ' + person });

    const sheet = getSheet_();
    let row = findRowForDate_(sheet, date);

    if (!row) {
      // Lägg till ny rad sist och skriv datumet.
      row = Math.max(sheet.getLastRow() + 1, DATA_START_ROW);
      sheet.getRange(row, COL_DATE).setValue(date);
    }

    sheet.getRange(row, PEOPLE[person]).setValue(done ? '✓' : '');

    return jsonResponse_({
      ok: true,
      task: getTask_(sheet),
      people: Object.keys(PEOPLE),
      entries: readEntries_(sheet),
    });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Hjälpare: bygger ett JSON-svar med CORS-vänliga inställningar. */
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
