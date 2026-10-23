import fs from 'node:fs';

// Read the real CLI output from stdin; the invalid fixture intentionally exits 1.
// Re-run with `npm run demo` from the repository root.
const command = 'node bin/changelog-guard.js lint test/fixtures/invalid-date-changelog.md --format json';
const output = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd();
const result = JSON.parse(output);
if (result.file !== 'test/fixtures/invalid-date-changelog.md' ||
    result.valid !== false || result.errorCount !== 1 ||
    result.diagnostics?.[0]?.rule !== 'non-iso-date') {
  throw new Error('Unexpected demo output. Check the fixture and CLI command.');
}

const escapeXml = value => value.replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
})[character]);

// Wrap terminal rows without changing the captured text. No timestamps or paths.
const columns = 100;
const wrap = line => line.match(new RegExp(`.{1,${columns}}`, 'g')) || [''];
const rows = [`$ ${command}`, '', ...output.split('\n')].flatMap(wrap);
const lineHeight = 22;
const height = 88 + rows.length * lineHeight;
const text = rows.map((line, index) =>
  `    <text x="28" y="${78 + index * lineHeight}" fill="${index === 0 ? '#7ee7b3' : '#dce5f2'}">${escapeXml(line)}</text>`
).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}" role="img" aria-labelledby="title desc">
  <title id="title">changelog-guard catches an invalid release date</title>
  <desc id="desc">Real JSON output from linting the invalid-date fixture. The non-iso-date diagnostic includes its line, column, and severity. This example exits with code 1.</desc>
  <rect width="1000" height="${height}" rx="14" fill="#0d1420"/>
  <path d="M14 0h972a14 14 0 0 1 14 14v30H0V14A14 14 0 0 1 14 0" fill="#1c2636"/>
  <circle cx="24" cy="22" r="6" fill="#ff6b6b"/>
  <circle cx="44" cy="22" r="6" fill="#f9c74f"/>
  <circle cx="64" cy="22" r="6" fill="#5fd793"/>
  <text x="500" y="27" text-anchor="middle" fill="#9aaac1" font-family="monospace" font-size="13">changelog-guard · lint</text>
  <g font-family="ui-monospace, SFMono-Regular, Consolas, monospace" font-size="15" xml:space="preserve">
${text}
  </g>
</svg>
`;

const target = new URL('../docs/demo.svg', import.meta.url);
fs.mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
fs.writeFileSync(target, svg, 'utf8');
console.log(`Generated docs/demo.svg from ${output.split('\n').length} lines of CLI output.`);
