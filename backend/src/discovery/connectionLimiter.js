
const DEFAULT_MAX_CONCURRENT_CONNECTIONS = 20;

function createAbortError(message = 'Operação cancelada.') {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function createConcurrencyLimiter(
  maxConcurrent = DEFAULT_MAX_CONCURRENT_CONNECTIONS
) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error(
      'O limite de concorrência deve ser um número inteiro maior que zero.'
    );
  }

  let activeCount = 0;
  const queue = [];

  function removeFromQueue(item) {
    const index = queue.indexOf(item);

    if (index !== -1) {
      queue.splice(index, 1);
      return true;
    }

    return false;
  }

  function releaseSlot() {
    activeCount--;
    drain();
  }

  function startTask(item) {
    activeCount++;

    if (item.signal && item.abortHandler) {
      item.signal.removeEventListener(
        'abort',
        item.abortHandler
      );

      item.abortHandler = null;
    }

    Promise.resolve()
      .then(() => {
        if (item.signal?.aborted) {
          throw createAbortError();
        }

        return item.task(item.signal);
      })
      .then(
        value => {
          releaseSlot();
          item.resolve(value);
        },
        error => {
          releaseSlot();
          item.reject(error);
        }
      );
  }

  function drain() {
    while (
      activeCount < maxConcurrent &&
      queue.length > 0
    ) {
      const item = queue.shift();

      if (item.signal?.aborted) {
        if (item.signal && item.abortHandler) {
          item.signal.removeEventListener(
            'abort',
            item.abortHandler
          );
        }

        item.reject(createAbortError());
        continue;
      }

      startTask(item);
    }
  }

  function run(task, { signal } = {}) {
    if (typeof task !== 'function') {
      return Promise.reject(
        new Error('A tarefa precisa ser uma função.')
      );
    }

    if (
      signal !== undefined &&
      (
        typeof signal !== 'object' ||
        typeof signal.aborted !== 'boolean' ||
        typeof signal.addEventListener !== 'function'
      )
    ) {
      return Promise.reject(
        new Error('Sinal de cancelamento inválido.')
      );
    }

    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }

    return new Promise((resolve, reject) => {
      const item = {
        task,
        signal,
        resolve,
        reject,
        abortHandler: null
      };

      if (signal) {
        item.abortHandler = () => {
          const removed = removeFromQueue(item);

          if (!removed) {
            return;
          }

          signal.removeEventListener(
            'abort',
            item.abortHandler
          );

          item.abortHandler = null;

          reject(createAbortError());
          drain();
        };

        signal.addEventListener(
          'abort',
          item.abortHandler,
          { once: true }
        );
      }

      queue.push(item);
      drain();
    });
  }

  return {
    run,

    get activeCount() {
      return activeCount;
    },

    get pendingCount() {
      return queue.length;
    },

    get maxConcurrent() {
      return maxConcurrent;
    }
  };
}

const connectionLimiter = createConcurrencyLimiter(
  DEFAULT_MAX_CONCURRENT_CONNECTIONS
);

export {
  DEFAULT_MAX_CONCURRENT_CONNECTIONS,
  createConcurrencyLimiter,
  connectionLimiter
};
