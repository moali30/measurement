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

console.log(
  `Chromium deployment trace verified: ${requiredArchives.length} runtime archives included.`,
);
