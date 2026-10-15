import { generateTotp, generateTotpSecret, getTotpUri, verifyTotp } from 'src/utils/totp.js';

// RFC 6238 test secret "12345678901234567890" in base32
const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp', () => {
  it('should match the RFC 6238 SHA1 test vectors', () => {
    expect(generateTotp(rfcSecret, 59_000)).toBe('287082');
    expect(generateTotp(rfcSecret, 1_111_111_109_000)).toBe('081804');
    expect(generateTotp(rfcSecret, 1_234_567_890_000)).toBe('005924');
    expect(generateTotp(rfcSecret, 20_000_000_000_000)).toBe('353130');
  });

  it('should accept codes within one step of drift', () => {
    const now = 1_111_111_109_000;
    expect(verifyTotp(rfcSecret, generateTotp(rfcSecret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(rfcSecret, generateTotp(rfcSecret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(rfcSecret, generateTotp(rfcSecret, now + 90_000), now)).toBe(false);
  });

  it('should reject malformed codes', () => {
    expect(verifyTotp(rfcSecret, '12345')).toBe(false);
    expect(verifyTotp(rfcSecret, 'abcdef')).toBe(false);
  });

  it('should generate a 160 bit base32 secret', () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('should build an otpauth uri', () => {
    expect(getTotpUri({ secret: rfcSecret, issuer: 'Immich', account: 'a@b.c' })).toBe(
      `otpauth://totp/Immich%3Aa%40b.c?secret=${rfcSecret}&issuer=Immich&algorithm=SHA1&digits=6&period=30`,
    );
  });
});
