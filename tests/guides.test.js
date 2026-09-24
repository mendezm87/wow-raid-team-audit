// Publishing the Markdown guides to Google Docs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadAppsScript, REPO_ROOT } = require('./helpers/appsScript');
const { buildGuideContentSource } = require('../scripts/build-guides');

test('src/GuideContent.gs is up to date with the Markdown guides', () => {
  const onDisk = fs.readFileSync(path.join(REPO_ROOT, 'src', 'GuideContent.gs'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(onDisk, buildGuideContentSource(), 'run `npm run build:guides`');
});

test('LaTeX math becomes plain symbols Google Docs can display', () => {
  const { context } = loadAppsScript();
  const md = 'Open $\\rightarrow$ Apps\n$$\\text{Score} = \\text{Gain} \\times \\text{Index}$$\n* `Veteran` ($1.10\\times$): $+10\\%$ bonus, $\\ge 10$ raiders, $\\mathbf{15\\%}$ on-time';
  const out = context.prepareGuideMarkdownForDocs(md, 'OFFICER_GUIDE.md', {});
  assert.equal(out, 'Open → Apps\n**Score = Gain × Index**\n* `Veteran` (1.10×): +10% bonus, ≥ 10 raiders, 15% on-time');
});

test('links: other guides -> their Docs, repo files -> GitHub, anchors -> plain text', () => {
  const { context } = loadAppsScript();
  const docs = { 'RAIDER_GUIDE.md': 'https://docs.google.com/document/d/RAIDER/edit', 'README.md': 'https://docs.google.com/document/d/README/edit' };
  const md = '[Raider](RAIDER_GUIDE.md) [dev](README.md#️-developing--deploying) [faq](#q-something) [src](src/) [web](https://raidbots.com)';
  assert.equal(
    context.prepareGuideMarkdownForDocs(md, 'OFFICER_GUIDE.md', docs),
    '[Raider](https://docs.google.com/document/d/RAIDER/edit) [dev](https://docs.google.com/document/d/README/edit) faq [src](https://github.com/mendezm87/wow-raid-team-audit/blob/main/src) [web](https://raidbots.com)'
  );
  // Paths inside discord-bot/README.md are relative to discord-bot/
  assert.equal(
    context.prepareGuideMarkdownForDocs('[main](../README.md) [env](.env.example)', 'discord-bot/README.md', docs),
    '[main](https://docs.google.com/document/d/README/edit) [env](https://github.com/mendezm87/wow-raid-team-audit/blob/main/discord-bot/.env.example)'
  );
});

test('parseGoogleDocId accepts normal Doc links only', () => {
  const { context } = loadAppsScript();
  assert.equal(context.parseGoogleDocId('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz_-0123456789/edit?usp=sharing'), '1AbCdEfGhIjKlMnOpQrStUvWxYz_-0123456789');
  assert.equal(context.parseGoogleDocId('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit'), null);
  assert.equal(context.parseGoogleDocId('hello'), null);
});

test('every published guide converts with no leftover LaTeX', () => {
  const { get, context } = loadAppsScript();
  const content = get('GUIDE_CONTENT');
  Object.keys(content).forEach(p => {
    const out = context.prepareGuideMarkdownForDocs(content[p].markdown, p, {});
    assert.doesNotMatch(out, /\$|\\(times|text|rightarrow|mathbf|ge)\b/, p);
  });
});
