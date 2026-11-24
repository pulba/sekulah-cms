/**
 * Turso SQL over HTTP Client (POST /v2/pipeline)
 * Pure standard fetch implementation for Cloudflare Workers, Edge, and Node/Bun.
 * Zero native C++/binary dependencies.
 * 
 * Spec: https://docs.turso.tech/sdk/http/reference
 */

export type TursoPrimitive =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | Uint8Array
  | ArrayBuffer;

export type TursoInValue =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

export interface TursoNamedArg {
  name: string;
  value: TursoInValue;
}

export type TursoPipelineRequest =
  | {
      type: 'execute';
      stmt: {
        sql: string;
        args?: TursoInValue[];
        named_args?: TursoNamedArg[];
      };
    }
  | {
      type: 'close';
    };

export interface TursoExecuteResult<T = Record<string, any>> {
  columns: string[];
  rows: T[];
  rowsAffected: number;
  lastInsertRowid: bigint | null;
  queryDurationMs?: number;
}

export interface TursoPipelineResponse {
  baton: string | null;
  base_url: string | null;
  results: Array<{
    type: 'ok' | 'error';
    error?: { message: string; code?: string };
    response?: {
      type: 'execute' | 'close';
      result?: {
        cols: Array<{ name: string; decltype: string | null }>;
        rows: Array<Array<{ type: string; value?: any; base64?: string }>>;
        affected_row_count: number;
        last_insert_rowid: string | null;
        query_duration_ms?: number;
      };
    };
  }>;
}

export interface TursoHttpConfig {
  url?: string;
  authToken?: string;
}

/**
 * Encode native JavaScript values to Turso JSON pipeline values
 */
export function encodeTursoValue(val: TursoPrimitive): TursoInValue {
  if (val === null || val === undefined) {
    return { type: 'null' };
  }
  if (typeof val === 'number') {
    return Number.isInteger(val)
      ? { type: 'integer', value: val.toString() }
      : { type: 'float', value: val };
  }
  if (typeof val === 'bigint') {
    return { type: 'integer', value: val.toString() };
  }
  if (typeof val === 'boolean') {
    return { type: 'integer', value: val ? '1' : '0' };
  }
  if (typeof val === 'string') {
    return { type: 'text', value: val };
  }
  if (val instanceof Uint8Array || val instanceof ArrayBuffer) {
    const bytes = val instanceof Uint8Array ? val : new Uint8Array(val);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { type: 'blob', base64: btoa(binary) };
  }
  return { type: 'text', value: String(val) };
}

/**
 * Decode Turso response value to native JavaScript value
 */
export function decodeTursoValue(val: { type: string; value?: any; base64?: string }): any {
  if (!val || val.type === 'null') return null;
  if (val.type === 'integer') {
    const num = Number(val.value);
    return Number.isSafeInteger(num) ? num : BigInt(val.value);
  }
  if (val.type === 'float') return Number(val.value);
  if (val.type === 'text') return val.value;
  if (val.type === 'blob') {
    const bin = atob(val.base64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  return val.value ?? val;
}

/**
 * Format raw execute result into structured JS objects
 */
function parseExecuteResult<T = Record<string, any>>(rawResult: any): TursoExecuteResult<T> {
  const cols: string[] = (rawResult.cols || []).map((c: any) => c.name);
  const rows: T[] = (rawResult.rows || []).map((row: any[]) => {
    const obj: Record<string, any> = {};
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]] = decodeTursoValue(row[i]);
    }
    return obj as T;
  });

  return {
    columns: cols,
    rows,
    rowsAffected: rawResult.affected_row_count ?? 0,
    lastInsertRowid: rawResult.last_insert_rowid ? BigInt(rawResult.last_insert_rowid) : null,
    queryDurationMs: rawResult.query_duration_ms,
  };
}

export class TursoHttpClient {
  private pipelineUrl: string;
  private authToken: string;

  constructor(config: TursoHttpConfig = {}) {
    const rawUrl = config.url || process.env.TURSO_DATABASE_URL || '';
    if (!rawUrl) {
      throw new Error('TURSO_DATABASE_URL is not set.');
    }

    // Normalize URL to https://[db]-[org].turso.io/v2/pipeline
    let baseUrl = rawUrl.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    if (!baseUrl.endsWith('/v2/pipeline')) {
      baseUrl = `${baseUrl}/v2/pipeline`;
    }

    this.pipelineUrl = baseUrl;
    this.authToken = config.authToken || process.env.TURSO_AUTH_TOKEN || '';
  }

  /**
   * Low-level raw /v2/pipeline request execution
   */
  async pipeline(requests: TursoPipelineRequest[], baton?: string | null): Promise<TursoPipelineResponse> {
    const body: Record<string, any> = { requests };
    if (baton) {
      body.baton = baton;
    }

    const response = await fetch(this.pipelineUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Turso HTTP pipeline error (${response.status} ${response.statusText}): ${errText}`);
    }

    const json = (await response.json()) as TursoPipelineResponse;

    // Check for query-level errors in results
    for (const res of json.results) {
      if (res.type === 'error') {
        throw new Error(`Turso query error: ${res.error?.message || 'Unknown error'}`);
      }
    }

    return json;
  }

  /**
   * Execute a single SQL query (positional or named parameters)
   * Automatically closes the pipeline connection.
   */
  async execute<T = Record<string, any>>(
    sql: string,
    params?: TursoPrimitive[] | Record<string, TursoPrimitive>
  ): Promise<TursoExecuteResult<T>> {
    const stmt: any = { sql };

    if (Array.isArray(params)) {
      stmt.args = params.map(encodeTursoValue);
    } else if (params && typeof params === 'object') {
      stmt.named_args = Object.entries(params).map(([key, val]) => ({
        name: key.startsWith(':') || key.startsWith('@') || key.startsWith('$') ? key : `:${key}`,
        value: encodeTursoValue(val),
      }));
    }

    const res = await this.pipeline([
      { type: 'execute', stmt },
      { type: 'close' },
    ]);

    const execResult = res.results[0]?.response?.result;
    if (!execResult) {
      return { columns: [], rows: [], rowsAffected: 0, lastInsertRowid: null };
    }

    return parseExecuteResult<T>(execResult);
  }

  /**
   * Execute multiple statements in one HTTP round-trip
   */
  async batch(
    statements: Array<{ sql: string; params?: TursoPrimitive[] | Record<string, TursoPrimitive> }>
  ): Promise<TursoExecuteResult[]> {
    const requests: TursoPipelineRequest[] = statements.map((item) => {
      const stmt: any = { sql: item.sql };
      if (Array.isArray(item.params)) {
        stmt.args = item.params.map(encodeTursoValue);
      } else if (item.params && typeof item.params === 'object') {
        stmt.named_args = Object.entries(item.params).map(([key, val]) => ({
          name: key.startsWith(':') || key.startsWith('@') || key.startsWith('$') ? key : `:${key}`,
          value: encodeTursoValue(val),
        }));
      }
      return { type: 'execute', stmt };
    });

    requests.push({ type: 'close' });

    const res = await this.pipeline(requests);

    return res.results
      .filter((r) => r.response?.type === 'execute')
      .map((r) => parseExecuteResult(r.response!.result!));
  }

  /**
   * Interactive multi-step transaction using Turso session baton.
   * Chained requests reuse the same server-side connection and guarantee `close` when done.
   */
  async transaction<R>(
    fn: (tx: {
      execute: <T = Record<string, any>>(
        sql: string,
        params?: TursoPrimitive[] | Record<string, TursoPrimitive>
      ) => Promise<TursoExecuteResult<T>>;
    }) => Promise<R>
  ): Promise<R> {
    // 1. Begin transaction to acquire baton
    const beginRes = await this.pipeline([
      { type: 'execute', stmt: { sql: 'BEGIN' } },
    ]);

    let baton = beginRes.baton;
    if (!baton) {
      throw new Error('Failed to obtain Turso session baton for transaction.');
    }

    try {
      // Wrapper for statements within the active baton session
      const txExecutor = {
        execute: async <T = Record<string, any>>(
          sql: string,
          params?: TursoPrimitive[] | Record<string, TursoPrimitive>
        ): Promise<TursoExecuteResult<T>> => {
          const stmt: any = { sql };
          if (Array.isArray(params)) {
            stmt.args = params.map(encodeTursoValue);
          } else if (params && typeof params === 'object') {
            stmt.named_args = Object.entries(params).map(([k, v]) => ({
              name: k.startsWith(':') || k.startsWith('@') || k.startsWith('$') ? k : `:${k}`,
              value: encodeTursoValue(v),
            }));
          }

          const res = await this.pipeline([{ type: 'execute', stmt }], baton);
          baton = res.baton || baton; // Update baton if refreshed
          const raw = res.results[0]?.response?.result;
          return raw ? parseExecuteResult<T>(raw) : { columns: [], rows: [], rowsAffected: 0, lastInsertRowid: null };
        },
      };

      const result = await fn(txExecutor);

      // 2. Commit transaction & close connection
      await this.pipeline(
        [
          { type: 'execute', stmt: { sql: 'COMMIT' } },
          { type: 'close' },
        ],
        baton
      );

      return result;
    } catch (err) {
      // 3. Rollback & close on error
      try {
        await this.pipeline(
          [
            { type: 'execute', stmt: { sql: 'ROLLBACK' } },
            { type: 'close' },
          ],
          baton
        );
      } catch {
        // Silently swallow rollback error to preserve original exception
      }
      throw err;
    }
  }
}

/**
 * Default singleton instance
 */
let defaultClient: TursoHttpClient | null = null;

export function getTursoHttpClient(config?: TursoHttpConfig): TursoHttpClient {
  if (config) {
    return new TursoHttpClient(config);
  }
  if (!defaultClient) {
    defaultClient = new TursoHttpClient();
  }
  return defaultClient;
}

export const tursoHttp = {
  execute: <T = Record<string, any>>(
    sql: string,
    params?: TursoPrimitive[] | Record<string, TursoPrimitive>
  ) => getTursoHttpClient().execute<T>(sql, params),

  batch: (
    statements: Array<{ sql: string; params?: TursoPrimitive[] | Record<string, TursoPrimitive> }>
  ) => getTursoHttpClient().batch(statements),

  transaction: <R>(
    fn: (tx: {
      execute: <T = Record<string, any>>(
        sql: string,
        params?: TursoPrimitive[] | Record<string, TursoPrimitive>
      ) => Promise<TursoExecuteResult<T>>;
    }) => Promise<R>
  ) => getTursoHttpClient().transaction(fn),

  pipeline: (requests: TursoPipelineRequest[], baton?: string | null) =>
    getTursoHttpClient().pipeline(requests, baton),
};
