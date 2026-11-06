
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from 'node:crypto';

import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

export async function hashPassword(password) {
  if (
    typeof password !== 'string' ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error(
      'A senha deve possuir entre 12 e 128 caracteres.'
    );
  }

  const salt = randomBytes(SALT_LENGTH).toString('hex');

  const derivedKey = await scrypt(
    password,
    salt,
    KEY_LENGTH
  );

  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  if (
    typeof password !== 'string' ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH ||
    typeof storedHash !== 'string'
  ) {
    return false;
  }

  const parts = storedHash.split(':');

  if (parts.length !== 2) {
    return false;
  }

  const [salt, storedKey] = parts;

  if (
    !/^[a-f0-9]{32}$/i.test(salt) ||
    !/^[a-f0-9]{128}$/i.test(storedKey)
  ) {
    return false;
  }

  try {
    const derivedKey = await scrypt(
      password,
      salt,
      KEY_LENGTH
    );

    const expectedKey = Buffer.from(storedKey, 'hex');

    return timingSafeEqual(
      derivedKey,
      expectedKey
    );
  } catch {
    return false;
  }
}
