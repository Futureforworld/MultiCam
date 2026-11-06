
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hashPassword,
  verifyPassword
} from '../src/services/authService.js';

const VALID_PASSWORD = 'MultiCamTeste2026!';

test('hashPassword deve gerar hash válido', async () => {
  const hash = await hashPassword(VALID_PASSWORD);

  assert.equal(typeof hash, 'string');
  assert.match(hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/i);
});

test('hashPassword deve rejeitar senha menor que 12 caracteres', async () => {
  await assert.rejects(
    hashPassword('Curta123!'),
    /12 e 128 caracteres/
  );
});

test('hashPassword deve rejeitar senha maior que 128 caracteres', async () => {
  await assert.rejects(
    hashPassword('A'.repeat(129)),
    /12 e 128 caracteres/
  );
});

test('verifyPassword deve aceitar senha correta', async () => {
  const hash = await hashPassword(VALID_PASSWORD);

  assert.equal(
    await verifyPassword(VALID_PASSWORD, hash),
    true
  );
});

test('verifyPassword deve rejeitar senha incorreta', async () => {
  const hash = await hashPassword(VALID_PASSWORD);

  assert.equal(
    await verifyPassword('OutraSenha2026!', hash),
    false
  );
});

test('verifyPassword deve rejeitar senha menor que 12 caracteres', async () => {
  const hash = await hashPassword(VALID_PASSWORD);

  assert.equal(
    await verifyPassword('Curta123!', hash),
    false
  );
});

test('verifyPassword deve rejeitar senha maior que 128 caracteres', async () => {
  const hash = await hashPassword(VALID_PASSWORD);

  assert.equal(
    await verifyPassword('A'.repeat(129), hash),
    false
  );
});

test('verifyPassword deve rejeitar hash malformado', async () => {
  assert.equal(
    await verifyPassword(VALID_PASSWORD, 'hash-invalido'),
    false
  );
});

test('verifyPassword deve rejeitar entradas de tipos inválidos', async () => {
  assert.equal(
    await verifyPassword(null, 'hash-invalido'),
    false
  );

  assert.equal(
    await verifyPassword(VALID_PASSWORD, null),
    false
  );
});
