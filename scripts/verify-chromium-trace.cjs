const fs = require('node:fs');
const path = require('node:path');

const tracePath = path.join(
  process.cwd(),
  '.next',
  'server',
  'app',
  'api',
  'reports',
  'analysis',
  'route.js.nft.json',
);

const requiredArchives = [
  'al2023.tar.br',
  'chromium.br',
  'fonts.tar.br',
  'swiftshader.tar.br',
];

if (!fs.existsSync(tracePath)) {
  console.error(`Chromium trace was not found: ${tracePath}`);
  console.error('Run `npm run build` before verifying the deployment trace.');
  process.exit(1);
}

const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
const tracedFiles = (trace.files || []).map((file) => file.replaceAll('\\', '/'));
const missingArchives = requiredArchives.filter(
  (archive) =>
    !tracedFiles.some((file) =>
      file.endsWith(`/node_modules/@sparticuz/chromium/bin/${archive}`),
    ),
);

if (missingArchives.length > 0) {
  console.error('The analysis API deployment trace is missing Chromium runtime archives:');
  for (const archive of missingArchives) {
    console.error(`- ${archive}`);
  }
  process.exit(1);
}

// The running header and footer render in a Chromium document that sees only
// system fonts, and the bundled Chromium ships Open Sans alone -- no Arabic.
// If this font stops being traced, every Arabic label in the page furniture
// silently disappears from the deployed PDF while still rendering locally.
const requiredFonts = ['fonts/Cairo-Variable.ttf'];
const missingFonts = requiredFonts.filter(
  (font) => !tracedFiles.some((file) => file.endsWith(`/${font}`)),
);

if (missingFonts.length > 0) {
  console.error('The analysis API deployment trace is missing Arabic fonts:');
  for (const font of missingFonts) {
    console.error(`- ${font}`);
  }
  process.exit(1);
}

console.log(
  `Chromium deployment trace verified: ${requiredArchives.length} runtime archives ` +
    `and ${requiredFonts.length} Arabic font included.`,
);
