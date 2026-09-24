// --- PUBLISH GUIDES TO GOOGLE DOCS ---
// Replaces the contents of the guild's existing Google Docs with the guides bundled in GUIDE_CONTENT
// (see GuideContent.gs). The Doc IDs don't change, so shared links keep working, and every publish
// is a new entry in each Doc's File > Version history.
const GUIDE_DOC_IDS_PROPERTY = 'guide_doc_ids'; // JSON: { "OFFICER_GUIDE.md": "<docId>" | "SKIP", ... }
const GUIDE_REPO_URL = 'https://github.com/mendezm87/wow-raid-team-audit/blob/main/';

function parseGoogleDocId(link) {
  const match = (link || '').toString().match(/\/document\/d\/([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : null;
}

/**
 * Makes GitHub-flavored Markdown read well as a Google Doc: LaTeX math becomes plain symbols,
 * links to other published guides point at their Docs, other repo links point at GitHub, and
 * in-page anchor links (which Docs can't follow) become plain text.
 */
function prepareGuideMarkdownForDocs(markdown, guidePath, docUrlByPath) {
  const latexToText = (expr) => expr
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\le\b/g, '≤')
    .replace(/\\%/g, '%')
    .replace(/\\,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let md = markdown
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => '**' + latexToText(expr) + '**') // display formulas
    .replace(/\$([^$\n]+?)\$/g, (_, expr) => latexToText(expr));                  // inline math

  const baseDir = guidePath.includes('/') ? guidePath.slice(0, guidePath.lastIndexOf('/') + 1) : '';
  const resolvePath = (rel) => {
    const parts = (baseDir + rel).split('/');
    const out = [];
    parts.forEach(p => { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
    return out.join('/');
  };

  md = md.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text, target) => {
    if (/^(https?:|mailto:)/i.test(target)) return whole;
    if (target.startsWith('#')) return text; // Docs can't follow GitHub heading anchors
    const [filePart] = target.split('#');
    const repoPath = resolvePath(filePart);
    if (docUrlByPath[repoPath]) return `[${text}](${docUrlByPath[repoPath]})`;
    return `[${text}](${GUIDE_REPO_URL}${repoPath})`;
  });
  return md;
}

function readGuideDocIds_() {
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(GUIDE_DOC_IDS_PROPERTY) || '{}');
  } catch (e) {
    return {};
  }
}

/**
 * Asks for each guide's Google Doc link (blank = don't publish that guide) and saves them.
 * Returns false if the officer cancelled.
 */
function promptForGuideDocLinks_(ui, docIds) {
  for (const path of Object.keys(GUIDE_CONTENT)) {
    const current = docIds[path] && docIds[path] !== 'SKIP' ? `\n\nCurrent: https://docs.google.com/document/d/${docIds[path]}/edit` : '';
    let docId = null;
    while (docId === null) {
      const resp = ui.prompt(
        `Google Doc for "${GUIDE_CONTENT[path].title}"`,
        `Paste the link to the existing Google Doc for ${GUIDE_CONTENT[path].title} (${path}).\nLeave blank to skip this guide.${current}`,
        ui.ButtonSet.OK_CANCEL
      );
      if (resp.getSelectedButton() !== ui.Button.OK) return false;
      const text = resp.getResponseText().trim();
      if (!text) { docId = 'SKIP'; break; }
      docId = parseGoogleDocId(text);
      if (!docId) ui.alert('Not a Google Doc link', 'The link should look like https://docs.google.com/document/d/.../edit', ui.ButtonSet.OK);
    }
    docIds[path] = docId;
  }
  PropertiesService.getScriptProperties().setProperty(GUIDE_DOC_IDS_PROPERTY, JSON.stringify(docIds));
  return true;
}

/**
 * Menu action: replaces the guild's Google Docs guides with the latest versions.
 */
function publishGuidesToGoogleDocs() {
  const ui = SpreadsheetApp.getUi();
  let docIds = readGuideDocIds_();
  const needsLinks = Object.keys(GUIDE_CONTENT).some(p => !docIds[p]);
  if (needsLinks && !promptForGuideDocLinks_(ui, docIds)) return;

  const targets = Object.keys(GUIDE_CONTENT).filter(p => docIds[p] && docIds[p] !== 'SKIP');
  const lines = targets.map(p => {
    let name = '(not accessible)';
    try { name = DriveApp.getFileById(docIds[p]).getName(); } catch (e) { /* reported on publish */ }
    return `• ${GUIDE_CONTENT[p].title} → "${name}"`;
  });

  const confirm = ui.alert(
    'Publish Guides to Google Docs?',
    (targets.length ? lines.join('\n') : 'No Docs selected.') +
      '\n\nThe current contents of these Docs will be REPLACED with the latest guides. Links and sharing stay the same, and the previous version can be restored from File > Version history in each Doc.' +
      '\n\nYES = publish now   •   NO = change which Docs are used',
    ui.ButtonSet.YES_NO_CANCEL
  );
  if (confirm === ui.Button.NO) {
    if (promptForGuideDocLinks_(ui, docIds)) publishGuidesToGoogleDocs();
    return;
  }
  if (confirm !== ui.Button.YES || targets.length === 0) return;

  const docUrlByPath = {};
  targets.forEach(p => { docUrlByPath[p] = `https://docs.google.com/document/d/${docIds[p]}/edit`; });

  const results = targets.map(p => {
    try {
      const file = DriveApp.getFileById(docIds[p]);
      if (file.getMimeType() !== MimeType.GOOGLE_DOCS) throw new Error('that link is not a Google Doc');
      const markdown = prepareGuideMarkdownForDocs(GUIDE_CONTENT[p].markdown, p, docUrlByPath);
      const resp = UrlFetchApp.fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${docIds[p]}?uploadType=media&supportsAllDrives=true`,
        {
          method: 'patch',
          contentType: 'text/markdown; charset=UTF-8',
          payload: Utilities.newBlob(markdown, 'text/markdown').getBytes(),
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
          muteHttpExceptions: true
        }
      );
      if (resp.getResponseCode() !== 200) throw new Error(`Drive returned ${resp.getResponseCode()}: ${resp.getContentText().slice(0, 200)}`);
      return `✅ ${GUIDE_CONTENT[p].title}`;
    } catch (e) {
      return `❌ ${GUIDE_CONTENT[p].title}: ${e.message}`;
    }
  });

  ui.alert('Publish Guides', results.join('\n'), ui.ButtonSet.OK);
}
