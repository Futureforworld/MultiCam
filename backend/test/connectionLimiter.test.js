
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createConcurrencyLimiter
} from '../src/discovery/connectionLimiter.js';

test('limitador não deve ultrapassar o máximo de tarefas simultâneas', async () => {
  const limiter = createConcurrencyLimiter(3);

  let active = 0;
  let peak = 0;

  const tasks = Array.from(
    { length: 15 },
    () => limiter.run(async () => {
      active++;
      peak = Math.max(peak, active);

      await new Promise(resolve => setTimeout(resolve, 20));

      active--;

      return true;
    })
  );

  const results = await Promise.all(tasks);

  assert.equal(results.length, 15);
  assert.equal(results.every(Boolean), true);
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.equal(limiter.activeCount, 0);
  assert.equal(limiter.pendingCount, 0);
});

test('limitador deve liberar vaga depois de uma tarefa com erro', async () => {
  const limiter = createConcurrencyLimiter(1);

  await assert.rejects(
    () => limiter.run(async () => {
      throw new Error('Falha simulada.');
    }),
    /Falha simulada/
  );

  const result = await limiter.run(async () => 'executado');

  assert.equal(result, 'executado');
  assert.equal(limiter.activeCount, 0);
  assert.equal(limiter.pendingCount, 0);
});

test('limitador deve executar tarefas respeitando a ordem da fila', async () => {
  const limiter = createConcurrencyLimiter(1);
  const executionOrder = [];

  await Promise.all([
    limiter.run(async () => executionOrder.push(1)),
    limiter.run(async () => executionOrder.push(2)),
    limiter.run(async () => executionOrder.push(3))
  ]);

  assert.deepEqual(executionOrder, [1, 2, 3]);
});

test('limitador deve rejeitar limite inválido', () => {
  assert.throws(
    () => createConcurrencyLimiter(0),
    /limite de concorrência/i
  );

  assert.throws(
    () => createConcurrencyLimiter(-1),
    /limite de concorrência/i
  );

  assert.throws(
    () => createConcurrencyLimiter(1.5),
    /limite de concorrência/i
  );
});

test('limitador deve rejeitar tarefas que não sejam funções', async () => {
  const limiter = createConcurrencyLimiter(2);

  await assert.rejects(
    () => limiter.run(null),
    /tarefa precisa ser uma função/i
  );
});

test('limitador deve retirar tarefa cancelada da fila', async () => {
  const limiter = createConcurrencyLimiter(1);
  const controller = new AbortController();

  let releaseFirstTask;

  const firstTask = limiter.run(() => {
    return new Promise(resolve => {
      releaseFirstTask = resolve;
    });
  });

  await new Promise(resolve => setImmediate(resolve));

  const secondTask = limiter.run(
    async () => 'não deve executar',
    { signal: controller.signal }
  );

  assert.equal(limiter.activeCount, 1);
  assert.equal(limiter.pendingCount, 1);

  controller.abort();

  await assert.rejects(
    secondTask,
    error => error.name === 'AbortError'
  );

  assert.equal(limiter.pendingCount, 0);
  assert.equal(limiter.activeCount, 1);

  releaseFirstTask('concluída');
  assert.equal(await firstTask, 'concluída');

  assert.equal(limiter.activeCount, 0);
  assert.equal(limiter.pendingCount, 0);
});

test('limitador deve rejeitar tarefa cujo sinal já esteja cancelado', async () => {
  const limiter = createConcurrencyLimiter(2);
  const controller = new AbortController();

  controller.abort();

  let taskExecuted = false;

  await assert.rejects(
    () => limiter.run(
      async () => {
        taskExecuted = true;
      },
      { signal: controller.signal }
    ),
    error => error.name === 'AbortError'
  );

  assert.equal(taskExecuted, false);
  assert.equal(limiter.activeCount, 0);
  assert.equal(limiter.pendingCount, 0);
});

test('limitador deve rejeitar sinal de cancelamento inválido', async () => {
  const limiter = createConcurrencyLimiter(2);

  await assert.rejects(
    () => limiter.run(
      async () => true,
      { signal: {} }
    ),
    /sinal de cancelamento inválido/i
  );
});

test('limitador deve cancelar várias tarefas pendentes sem executá-las', async () => {
  const limiter = createConcurrencyLimiter(1);
  const controller = new AbortController();

  let releaseFirstTask;
  let executedPendingTasks = 0;

  const firstTask = limiter.run(() => {
    return new Promise(resolve => {
      releaseFirstTask = resolve;
    });
  });

  await new Promise(resolve => setImmediate(resolve));

  const pendingTasks = Array.from(
    { length: 5 },
    () => limiter.run(
      async () => {
        executedPendingTasks++;
        return true;
      },
      { signal: controller.signal }
    )
  );

  assert.equal(limiter.activeCount, 1);
  assert.equal(limiter.pendingCount, 5);

  controller.abort();

  const results = await Promise.allSettled(pendingTasks);

  assert.equal(
    results.every(
      result =>
        result.status === 'rejected' &&
        result.reason.name === 'AbortError'
    ),
    true
  );

  assert.equal(executedPendingTasks, 0);
  assert.equal(limiter.pendingCount, 0);
  assert.equal(limiter.activeCount, 1);

  releaseFirstTask('concluída');

  assert.equal(await firstTask, 'concluída');
  assert.equal(limiter.activeCount, 0);
  assert.equal(limiter.pendingCount, 0);
});

test('limitador deve verificar cancelamento antes de iniciar a tarefa', async () => {
  const limiter = createConcurrencyLimiter(1);
  const controller = new AbortController();

  let releaseFirstTask;
  let secondTaskExecuted = false;

  const firstTask = limiter.run(() => {
    return new Promise(resolve => {
      releaseFirstTask = resolve;
    });
  });

  await new Promise(resolve => setImmediate(resolve));

  const secondTask = limiter.run(
    async () => {
      secondTaskExecuted = true;
      return true;
    },
    { signal: controller.signal }
  );

  assert.equal(limiter.pendingCount, 1);

  releaseFirstTask('primeira concluída');

  controller.abort();

  assert.equal(await firstTask, 'primeira concluída');

  await assert.rejects(
    secondTask,
    error => error.name === 'AbortError'
  );

  assert.equal(secondTaskExecuted, false);
  assert.equal(limiter.activeCount, 0);
  assert.equal(limiter.pendingCount, 0);
});
