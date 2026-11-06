
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createDatabase } from '../database/database.js';
import { hashPassword } from '../services/authService.js';

const environmentPath = fileURLToPath(
  new URL('../../../.env', import.meta.url)
);

dotenv.config({ path: environmentPath });

async function createSuperadmin() {
  const email = process.env.MULTICAM_ADMIN_EMAIL
    ?.trim()
    .toLowerCase();

  const password = process.env.MULTICAM_ADMIN_PASSWORD;

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('Informe um e-mail válido.');
  }

  if (
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 128
  ) {
    throw new Error(
      'A senha deve possuir entre 12 e 128 caracteres.'
    );
  }

  const db = createDatabase();

  try {
    const passwordHash = await hashPassword(password);

    db.exec('BEGIN IMMEDIATE');

    try {
      const existingUsers = db.prepare(`
        SELECT COUNT(*) AS total
        FROM users
      `).get().total;

      if (existingUsers > 0) {
        throw new Error(
          'Já existem usuários cadastrados. Inicialização recusada.'
        );
      }

      db.prepare(`
        INSERT INTO users (
          email,
          passwordHash,
          role,
          status
        )
        VALUES (?, ?, 'superadmin', 'active')
      `).run(email, passwordHash);

      db.exec('COMMIT');

      console.log('Superadministrador criado com sucesso.');
      console.log(`E-mail cadastrado: ${email}`);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } finally {
    db.close();
  }
}

createSuperadmin().catch(error => {
  console.error(
    'Falha ao criar superadministrador:',
    error.message
  );

  process.exitCode = 1;
});
