import { describe, expect, it } from 'vitest';
import { isNewer, readRelease } from '@/app/updateCheck';

describe('aviso de versão nova', () => {
  it('compara versões número a número', () => {
    expect(isNewer('1.0.24', '1.0.23')).toBe(true);
    expect(isNewer('v1.0.100', '1.0.99')).toBe(true);
    expect(isNewer('1.0.23', '1.0.23')).toBe(false);
    expect(isNewer('1.0.9', '1.0.10')).toBe(false);
    expect(isNewer('1.1', '1.0.40')).toBe(true);
    expect(isNewer('1.0.18', '1.0.27-dev')).toBe(false);
    expect(isNewer('1.0.28', '1.0.27-dev')).toBe(true);
  });
  it('lê a release publicada e ignora rascunho ou sem APK', () => {
    const rel = { tag_name: 'v1.0.24', html_url: 'https://github.com/x/releases/tag/v1.0.24', assets: [{ name: 'precivora-1.0.24.apk', browser_download_url: 'https://github.com/x/p.apk' }] };
    expect(readRelease(rel)).toEqual({ version: '1.0.24', apk: 'https://github.com/x/p.apk', page: 'https://github.com/x/releases/tag/v1.0.24' });
    expect(readRelease({ ...rel, draft: true })).toBeNull();
    expect(readRelease({ ...rel, assets: [] })).toBeNull();
    expect(readRelease(null)).toBeNull();
  });
});
