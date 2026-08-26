/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * محمّل وحدات TypeScript لسكربتات التحقق.
 *
 * المشروع بلا مشغّل اختبارات، وسكربتات التحقق تحتاج استدعاء المحرك نفسه الذي
 * يعمل في التطبيق — لا نسخة موازية منه. هذا المحمّل ينقل الملف إلى CommonJS
 * في الذاكرة ويفكّ اختصار `@/`، فتبقى السكربتات تقرأ المصدر الحقيقي.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const moduleCache = new Map();

function resolveLocalModule(fromFile, request) {
  const base = request.startsWith('@/')
    ? path.join(projectRoot, 'src', request.slice(2))
    : path.resolve(path.dirname(fromFile), request);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${request} from ${fromFile}`);
}

function loadTypeScriptModule(filename) {
  const absolute = path.resolve(projectRoot, filename);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;

  const loaded = { exports: {} };
  moduleCache.set(absolute, loaded);
  const source = fs.readFileSync(absolute, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
    fileName: absolute,
  }).outputText;

  const localRequire = (request) => {
    if (request.startsWith('.') || request.startsWith('@/')) {
      return loadTypeScriptModule(resolveLocalModule(absolute, request));
    }
    return require(request);
  };

  const execute = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  execute(loaded.exports, localRequire, loaded, absolute, path.dirname(absolute));
  return loaded.exports;
}

module.exports = { loadTypeScriptModule, projectRoot };
