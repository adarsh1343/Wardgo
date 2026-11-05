// Adapts Node's built-in SQLite (node:sqlite, Node 22.5+) to the app's Db
// interface so migrations and repositories run against a real SQLite engine.
import type { Db, SqlParam } from '../src/database/db';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      run(...p: SqlParam[]): { changes: number | bigint };
      all(...p: SqlParam[]): unknown[];
      get(...p: SqlParam[]): unknown;
    };
    close(): void;
  };
};

export function createTestDb(): Db & { close(): void } {
  const db = new DatabaseSync(':memory:');
  let depth = 0;
  const plain = <T>(row: unknown): T => (row ? ({ ...(row as object) } as T) : (row as T));
  return {
    execAsync: async (sql) => db.exec(sql),
    runAsync: async (sql, params = []) => ({ changes: Number(db.prepare(sql).run(...params).changes) }),
    getAllAsync: async <T>(sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...params).map((r) => plain<T>(r)),
    getFirstAsync: async <T>(sql: string, params: SqlParam[] = []) => {
      const r = db.prepare(sql).get(...params);
      return r ? plain<T>(r) : null;
    },
    withTransactionAsync: async (task) => {
      // expo-sqlite cannot nest BEGIN; fail loudly so tests catch accidental nesting.
      if (depth > 0) throw new Error('Nested transaction');
      depth++;
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close: () => db.close(),
  };
}
