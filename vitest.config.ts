import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * اختبارات منطق التحليل فقط — لا مكوّنات ولا DOM.
 *
 * المحرك رياضيات نقية، فبيئة `node` أسرع وأقرب إلى ما يشغّله الخادم فعلاً.
 * وسلامة التخطيط والطباعة تُفحص بمتصفّح حقيقي في `scripts/verify-report-layout.cjs`،
 * لأن القصّ والفيض لا يظهران إلا بعد تنسيق فعلي على ورق A4.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: 'default',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
