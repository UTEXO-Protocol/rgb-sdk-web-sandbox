import type { SdkLogEntry } from '../store';

export function wrapWallet<T extends object>(
  instance: T,
  addSdkLog: (entry: SdkLogEntry) => void,
): T {
  // Facade extensions are non-configurable, non-writable own properties.
  // A proxy of the instance cannot substitute those values. Use a separate
  // target and forward reads/calls to the real instance instead.
  return new Proxy(Object.create(Object.getPrototypeOf(instance)) as T, {
    has: (_target, prop) => prop in instance,
    ownKeys: () => Reflect.ownKeys(instance),
    getOwnPropertyDescriptor: (_target, prop) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(instance, prop);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
    get(_target, prop) {
      const orig = Reflect.get(instance, prop, instance);
      if (typeof orig !== 'function' || typeof prop === 'symbol') return orig;
      return function (...args: unknown[]) {
        const start = Date.now();
        const method = String(prop);
        // Backup passwords and archive bytes must not land in the SDK log.
        const logArgs = method === 'exportBackup' || method === 'restoreBackup'
          ? args.map((arg) => arg && typeof arg === 'object'
            ? { ...arg, password: '[redacted]', ...('bytes' in arg ? { bytes: '[backup bytes]' } : {}) }
            : arg)
          : args;
        try {
          const ret = (orig as Function).apply(instance, args);
          // Only log async calls — sync getters (getNetwork, etc.) are called during
          // render and logging them would trigger Zustand state updates mid-render.
          if (ret instanceof Promise) {
            const id = crypto.randomUUID();
            const ts = new Date().toLocaleTimeString();
            return ret
              .then((result: unknown) => {
                addSdkLog({ id, ts, method, args: logArgs, result: method === 'exportBackup' ? '[backup bytes]' : result, durationMs: Date.now() - start, status: 'ok' });
                return result;
              })
              .catch((err: unknown) => {
                addSdkLog({ id, ts, method, args: logArgs, error: String(err), durationMs: Date.now() - start, status: 'error' });
                throw err;
              });
          }
          return ret;
        } catch (err) {
          addSdkLog({ id: crypto.randomUUID(), ts: new Date().toLocaleTimeString(), method, args: logArgs, error: String(err), durationMs: Date.now() - start, status: 'error' });
          throw err;
        }
      };
    },
  });
}
