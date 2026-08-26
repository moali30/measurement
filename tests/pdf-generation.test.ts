import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportData } from '@/types/analysis';

const mocks = vi.hoisted(() => {
  const page = {
    addInitScript: vi.fn(async () => undefined),
    goto: vi.fn(async () => {
      throw new Error('page.goto: net::ERR_INSUFFICIENT_RESOURCES');
    }),
  };
  const browser = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };

  return {
    browser,
    page,
    launch: vi.fn(async (_options: unknown) => browser),
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

vi.mock('playwright-core', () => ({ chromium: { launch: mocks.launch } }));

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

    const launchOptions = mocks.launch.mock.calls[0][0] as { args: string[] };
    const profileArg = launchOptions.args.find((arg) => arg.startsWith('--user-data-dir='));

    expect(profileArg).toMatch(/^--user-data-dir=.*playwright-[0-9a-f-]{36}$/i);
    const profilePath = profileArg!.slice('--user-data-dir='.length);

    expect(mocks.browser.close).toHaveBeenCalledOnce();
    expect(mocks.removeProfile).toHaveBeenCalledWith(profilePath, {
      recursive: true,
      force: true,
    });
    expect(mocks.browser.close.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeProfile.mock.invocationCallOrder[0]
    );
  });
});
