import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;
const DIGITS = 6;
// accepts codes from one step before and after, to cover clock drift
const WINDOW = 1;

const toBase32 = (buffer: Buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
};

const fromBase32 = (input: string) => {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of input.toUpperCase().replaceAll(/[\s=]/g, '')) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits < 8) {
      continue;
    }
    bytes.push((value >>> (bits - 8)) & 255);
    bits -= 8;
  }
  return Buffer.from(bytes);
};

const generateCode = (secret: Buffer, step: number) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', secret).update(counter).digest();
  const offset = hmac.at(-1)! & 0xf;
  const binary = hmac.readUInt32BE(offset) & 0x7f_ff_ff_ff;
  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
};

export const generateTotpSecret = () => toBase32(randomBytes(20));

export const getTotpUri = ({ secret, issuer, account }: { secret: string; issuer: string; account: string }) => {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
};

export const verifyTotp = (secret: string, code: string, now = Date.now()) => {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  const key = fromBase32(secret);
  const currentStep = Math.floor(now / 1000 / PERIOD_SECONDS);
  for (let delta = -WINDOW; delta <= WINDOW; delta++) {
    const expected = generateCode(key, currentStep + delta);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true;
    }
  }
  return false;
};

export const generateTotp = (secret: string, now = Date.now()) =>
  generateCode(fromBase32(secret), Math.floor(now / 1000 / PERIOD_SECONDS));
