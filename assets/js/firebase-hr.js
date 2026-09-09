// HR data is accessed only through an authenticated Cloud Function proxy.
// No HR Firebase API key, database URL, or direct database client is bundled.
import { callHrDatabaseFunction } from './firebase.js';

const hrDatabase = Object.freeze({ type: 'hr-database-proxy' });

class HrDataSnapshot {
  constructor(path, value) {
    this.path = path;
    this.key = path.split('/').filter(Boolean).at(-1) || null;
    this._value = value ?? null;
  }

  exists() {
    return this._value !== null && this._value !== undefined;
  }

  val() {
    return this._value;
  }

  child(childPath) {
    const parts = String(childPath ?? '').split('/').filter(Boolean);
    let value = this._value;
    for (const part of parts) {
      value = value && typeof value === 'object' ? value[part] : null;
    }
    return new HrDataSnapshot(
      [this.path, ...parts].filter(Boolean).join('/'),
      value,
    );
  }

  forEach(callback) {
    if (!this._value || typeof this._value !== 'object') return false;
    for (const [key, value] of Object.entries(this._value)) {
      if (callback(new HrDataSnapshot(`${this.path}/${key}`, value)) === true) {
        return true;
      }
    }
    return false;
  }
}

function ref(database, path) {
  if (database !== hrDatabase) {
    throw new Error('HR database reference is invalid');
  }
  const normalizedPath = String(path ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!normalizedPath) {
    throw new Error('HR database path is required');
  }
  return Object.freeze({ path: normalizedPath });
}

async function get(reference) {
  const result = await callHrDatabaseFunction('get', reference.path);
  return new HrDataSnapshot(reference.path, result?.value ?? null);
}

async function set(reference, value) {
  await callHrDatabaseFunction('set', reference.path, value);
}

async function update(reference, value) {
  await callHrDatabaseFunction('update', reference.path, value);
}

async function remove(reference) {
  await callHrDatabaseFunction('remove', reference.path);
}

export { hrDatabase, ref, get, set, update, remove };
