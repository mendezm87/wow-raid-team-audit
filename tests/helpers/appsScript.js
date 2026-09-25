// Loads the Apps Script sources (src/*.gs, in the same order clasp pushes them) into a Node VM with
// in-memory mocks of the Google services the code touches, so sheet logic can be tested locally.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Returns the src/*.gs file paths in clasp's filePushOrder (the order Apps Script loads them). */
function getSourceFiles() {
  const clasp = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.clasp.json'), 'utf8'));
  return clasp.filePushOrder.map(f => path.join(REPO_ROOT, f));
}

/** All sources joined into one script, equivalent to how Apps Script shares one global scope. */
function readConcatenatedSource() {
  return getSourceFiles().map(f => fs.readFileSync(f, 'utf8')).join('\n');
}

// ---------- Google service mocks ----------

function createSheet(name) {
  let data = [];
  let notes = [];
  let hidden = false;
  const sheet = {
    name,
    get data() { return data; },
    isHidden: () => hidden,
    hideSheet() { hidden = true; return sheet; },
    getLastRow: () => data.length,
    getLastColumn: () => Math.max(0, ...data.map(r => (r || []).length)),
    getParent: () => sheet._parent,
    clearContents() { data = []; return sheet; },
    setFrozenRows() { return sheet; },
    getDataRange() { return sheet.getRange(1, 1, Math.max(data.length, 1), Math.max(1, ...data.map(r => r.length))); },
    getRange(row, col, numRows = 1, numCols = 1) {
      const range = {
        setNumberFormat() { return range; },
        setValues(values) {
          for (let i = 0; i < numRows; i++) {
            data[row - 1 + i] = data[row - 1 + i] || [];
            for (let j = 0; j < numCols; j++) data[row - 1 + i][col - 1 + j] = values[i][j];
          }
          return range;
        },
        getValues() {
          const out = [];
          for (let i = 0; i < numRows; i++) {
            const r = [];
            for (let j = 0; j < numCols; j++) r.push(((data[row - 1 + i] || [])[col - 1 + j]) ?? '');
            out.push(r);
          }
          return out;
        },
        getDisplayValues() { return range.getValues().map(r => r.map(v => String(v))); },
        setNotes(values) {
          for (let i = 0; i < numRows; i++) {
            notes[row - 1 + i] = notes[row - 1 + i] || [];
            for (let j = 0; j < numCols; j++) notes[row - 1 + i][col - 1 + j] = values[i][j];
          }
          return range;
        },
        getNotes() {
          return Array.from({ length: numRows }, (_, i) =>
            Array.from({ length: numCols }, (_, j) => ((notes[row - 1 + i] || [])[col - 1 + j]) ?? ''));
        }
      };
      return range;
    }
  };
  return sheet;
}

function createPropertyStore(initial = {}) {
  const store = { ...initial };
  return {
    _store: store,
    getProperty: k => (k in store ? store[k] : null),
    setProperty: (k, v) => { store[k] = String(v); },
    setProperties: obj => { Object.entries(obj).forEach(([k, v]) => { store[k] = String(v); }); },
    deleteProperty: k => { delete store[k]; }
  };
}

/** Formats like Utilities.formatDate for the handful of patterns the code uses (always Pacific time). */
function formatDate(date, tz, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date).map(p => [p.type, p.value]));
  const mm = String(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(parts.month) + 1).padStart(2, '0');
  const dd = parts.day.padStart(2, '0');
  switch (pattern) {
    case 'yyyy-MM-dd': return `${parts.year}-${mm}-${dd}`;
    case 'EEEE': return parts.weekday;
    case 'EEE, MMM d, yyyy': return `${parts.weekday.slice(0, 3)}, ${parts.month} ${parts.day}, ${parts.year}`;
    default: return `${parts.year}-${mm}-${dd} ${parts.hour}:${parts.minute}`;
  }
}

/**
 * Creates a fresh sandbox with all sources loaded.
 * @param {object} opts
 * @param {boolean} [opts.withUi=true]  false simulates a time-driven trigger (SpreadsheetApp.getUi() throws)
 * @param {function} [opts.fetch]       UrlFetchApp.fetch(url, options) implementation
 */
function loadAppsScript(opts = {}) {
  const { withUi = true, fetch = () => { throw new Error('Unexpected UrlFetchApp.fetch'); } } = opts;
  const sheets = {};
  const spreadsheet = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { sheets[n] = createSheet(n); sheets[n]._parent = spreadsheet; return sheets[n]; }
  };
  const alerts = [];
  const logs = [];
  const scriptProps = createPropertyStore(opts.scriptProperties);
  const userProps = createPropertyStore(opts.userProperties);

  // Script lock mock: `lock.busy = true` simulates another execution holding it
  const lock = {
    busy: false, held: false, acquisitions: 0,
    tryLock() { if (lock.busy) return false; lock.held = true; lock.acquisitions++; return true; },
    releaseLock() { lock.held = false; }
  };

  const ui = {
    alert: (title, message) => { alerts.push({ title, message }); },
    ButtonSet: { OK: 'OK', YES_NO: 'YES_NO', OK_CANCEL: 'OK_CANCEL' },
    Button: { OK: 'OK', YES: 'YES' }
  };

  const context = {
    console, JSON, Date, Math, Object, Array, Set, Map, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat, Intl,
    SpreadsheetApp: {
      flush() {},
      getActiveSpreadsheet: () => spreadsheet,
      getUi() {
        if (!withUi) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.');
        return ui;
      }
    },
    PropertiesService: { getScriptProperties: () => scriptProps, getUserProperties: () => userProps },
    UrlFetchApp: { fetch: (...args) => fetch(...args) },
    Utilities: { formatDate, base64Encode: s => Buffer.from(String(s)).toString('base64') },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({ text, setMimeType() { return this; } })
    },
    LockService: { getScriptLock: () => lock },
    Logger: { log: m => logs.push(String(m)) },
    Session: { getScriptTimeZone: () => 'America/Los_Angeles' }
  };
  vm.createContext(context);
  vm.runInContext(readConcatenatedSource(), context, { filename: 'src (concatenated)' });

  // Top-level const/let aren't properties of the VM global, so expose them via a getter
  const get = expr => vm.runInContext(expr, context);
  return { context, get, sheets, spreadsheet, alerts, logs, scriptProps, userProps, createSheet, lock };
}

module.exports = { loadAppsScript, readConcatenatedSource, getSourceFiles, createSheet, REPO_ROOT };
