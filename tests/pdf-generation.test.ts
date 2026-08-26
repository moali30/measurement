import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportData } from '@/types/analysis';

const mocks = vi.hoisted(() => {
  const page = {
    addInitScript: vi.fn(async () => undefined),
    goto: vi.fn(async () => {
      throw new Error('page.goto: net::ERR_INSUFFICIENT_RESOURCES');
    }),
  };
  const persistentContext = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };

  return {
    persistentContext,
    page,
    launchPersistentContext: vi.fn(
      async (_userDataDir: string, _options: unknown) => persistentContext
    ),
    executablePath: vi.fn(async () => '/tmp/chromium'),
    removeProfile: vi.fn(async () => undefined),
  };
});

vi.mock('node:fs', () => ({
  copyFileSync: vi.fn(),
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

vi.mock('node:fs/promises', () => ({ rm: mocks.removeProfile }));

vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--no-sandbox'],
    executablePath: mocks.executablePath,
  },
}));

vi.mock('playwright-core', () => ({
  chromium: { launchPersistentContext: mocks.launchPersistentContext },
}));

import { generateAnalysisPdf } from '@/lib/pdf/generate-analysis-pdf';

describe('تنظيف Chromium في Vercel', () => {
  const originalVercel = process.env.VERCEL;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.VERCEL = '1';
    vi.clearAllMocks();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('يعزل ملف المستخدم ويحذفه حتى عند فشل الانتقال', async () => {
    await expect(generateAnalysisPdf({} as ReportData)).rejects.toThrow(
      'net::ERR_INSUFFICIENT_RESOURCES'
    );

    const [profilePath, launchOptions] = mocks.launchPersistentContext.mock.calls[0] as [
      string,
      { args: string[] },
    ];

    expect(profilePath).toMatch(/playwright-[0-9a-f-]{36}$/i);
    expect(launchOptions.args).not.toContainEqual(expect.stringContaining('--user-data-dir='));

    expect(mocks.persistentContext.close).toHaveBeenCalledOnce();
    expect(mocks.removeProfile).toHaveBeenCalledWith(profilePath, {
      recursive: true,
      force: true,
    });
    expect(mocks.persistentContext.close.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeProfile.mock.invocationCallOrder[0]
    );
  });
});
