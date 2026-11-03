// ROLE: Unit tests for the WebGL2 GPU timer wrapper using a fake context with the core query API.
import { describe, expect, it } from "vitest";
import { GpuTimer } from "./GpuTimer";

interface FakeQueryState {
  available: boolean;
  resultNs: number;
}

interface FakeOptions {
  withExtension?: boolean;
  withConstants?: boolean;
  /** Simulates a WebGL1-style extension object with createQueryEXT etc. */
  withLegacyExtensionMethods?: boolean;
}

/**
 * Minimal WebGL2 stand-in: the extension only carries constants, while the
 * query calls live on the context, exactly like the real WebGL2 API.
 */
class FakeWebGL2Context {
  public disjoint = false;
  public failCreateQuery = false;
  public beginCalls = 0;
  public endCalls = 0;
  public legacyCalls = 0;
  public activeQuery: WebGLQuery | null = null;
  public readonly beginTargets: number[] = [];
  public readonly endTargets: number[] = [];
  public readonly created: WebGLQuery[] = [];
  public readonly deleted: WebGLQuery[] = [];
  public readonly QUERY_RESULT = 0x8866;
  public readonly QUERY_RESULT_AVAILABLE = 0x8867;
  public readonly GPU_DISJOINT_EXT = 0x8fbb;
  public readonly TIME_ELAPSED_EXT = 0x88bf;

  private readonly states = new Map<WebGLQuery, FakeQueryState>();
  private readonly withExtension: boolean;
  private readonly withConstants: boolean;
  private readonly withLegacyExtensionMethods: boolean;

  constructor(options: FakeOptions = {}) {
    this.withExtension = options.withExtension ?? true;
    this.withConstants = options.withConstants ?? true;
    this.withLegacyExtensionMethods = options.withLegacyExtensionMethods ?? false;
  }

  public getExtension(name: string): unknown {
    if (name !== "EXT_disjoint_timer_query_webgl2") return null;
    if (!this.withExtension) return null;

    const extension: Record<string, unknown> = {};
    if (this.withConstants) {
      extension.GPU_DISJOINT_EXT = this.GPU_DISJOINT_EXT;
      extension.TIME_ELAPSED_EXT = this.TIME_ELAPSED_EXT;
    }
    if (this.withLegacyExtensionMethods) {
      extension.createQueryEXT = () => {
        this.legacyCalls += 1;
        return null;
      };
      extension.beginQueryEXT = () => {
        this.legacyCalls += 1;
      };
      extension.endQueryEXT = () => {
        this.legacyCalls += 1;
      };
      extension.deleteQueryEXT = () => {
        this.legacyCalls += 1;
      };
    }
    return extension;
  }

  public createQuery(): WebGLQuery | null {
    if (this.failCreateQuery) return null;

    const query: WebGLQuery = {};
    this.created.push(query);
    this.states.set(query, { available: false, resultNs: 0 });
    return query;
  }

  public beginQuery(target: number, query: WebGLQuery): void {
    this.beginCalls += 1;
    this.beginTargets.push(target);
    this.activeQuery = query;
  }

  public endQuery(target: number): void {
    this.endCalls += 1;
    this.endTargets.push(target);
  }

  public getQueryParameter(query: WebGLQuery, pname: number): unknown {
    const state = this.states.get(query);
    if (pname === this.QUERY_RESULT_AVAILABLE) return state?.available ?? false;
    if (pname === this.QUERY_RESULT) return state?.resultNs ?? 0;
    return 0;
  }

  public getParameter(pname: number): unknown {
    if (pname !== this.GPU_DISJOINT_EXT) return undefined;
    return this.disjoint;
  }

  public deleteQuery(query: WebGLQuery): void {
    this.deleted.push(query);
    this.states.delete(query);
  }

  public finishLatest(resultNs: number): void {
    const query = this.created[this.created.length - 1];
    const state = this.states.get(query);
    if (!state) throw new Error("no query was created");
    state.available = true;
    state.resultNs = resultNs;
  }
}

function createTimer(context: FakeWebGL2Context): GpuTimer {
  return new GpuTimer(context as unknown as WebGL2RenderingContext);
}

/** Drops the WebGL2 core query functions but keeps the context otherwise intact. */
function withoutCoreQueryApi(context: FakeWebGL2Context): FakeWebGL2Context {
  const mutable = context as unknown as Record<string, unknown>;
  mutable.createQuery = undefined;
  mutable.beginQuery = undefined;
  mutable.endQuery = undefined;
  mutable.getQueryParameter = undefined;
  mutable.deleteQuery = undefined;
  return context;
}

describe("GpuTimer", () => {
  it("is an inert unsupported timer when the extension is missing", () => {
    const context = new FakeWebGL2Context({ withExtension: false });
    const timer = createTimer(context);

    expect(timer.supported).toBe(false);
    expect(() => {
      timer.begin();
      timer.end();
      timer.dispose();
    }).not.toThrow();
    expect(timer.poll()).toBeNull();
    expect(context.created).toHaveLength(0);
    expect(context.beginCalls).toBe(0);
    expect(context.endCalls).toBe(0);
  });

  it("is inert when the extension lacks its numeric constants", () => {
    const context = new FakeWebGL2Context({ withConstants: false });
    const timer = createTimer(context);

    expect(timer.supported).toBe(false);
    timer.begin();
    timer.end();
    expect(timer.poll()).toBeNull();
    expect(context.created).toHaveLength(0);
  });

  it("ignores WebGL1-style extension methods when the context has no query API", () => {
    const context = withoutCoreQueryApi(
      new FakeWebGL2Context({ withLegacyExtensionMethods: true }),
    );
    const timer = createTimer(context);

    expect(timer.supported).toBe(false);
    expect(() => {
      timer.begin();
      timer.end();
      timer.dispose();
    }).not.toThrow();
    expect(timer.poll()).toBeNull();
    expect(context.legacyCalls).toBe(0);
    expect(context.created).toHaveLength(0);
  });

  it("only accepts the WebGL2 extension name", () => {
    const context = new FakeWebGL2Context();

    expect(context.getExtension("EXT_disjoint_timer_query")).toBeNull();
    expect(context.getExtension("EXT_disjoint_timer_query_webgl2")).not.toBeNull();

    const timer = createTimer(context);
    expect(timer.supported).toBe(true);
  });

  it("degrades to unsupported when the context cannot allocate a query", () => {
    const context = new FakeWebGL2Context();
    context.failCreateQuery = true;
    const timer = createTimer(context);

    expect(timer.supported).toBe(false);
    expect(context.created).toHaveLength(0);
    timer.begin();
    timer.end();
    expect(context.beginCalls).toBe(0);
    expect(timer.poll()).toBeNull();
    expect(() => timer.dispose()).not.toThrow();
  });

  it("returns GPU milliseconds once the query result is available", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    expect(timer.supported).toBe(true);
    expect(context.created).toHaveLength(1);

    timer.begin();
    expect(context.beginCalls).toBe(1);
    expect(context.beginTargets).toEqual([context.TIME_ELAPSED_EXT]);
    expect(context.activeQuery).toBe(context.created[0]);

    timer.end();
    expect(context.endCalls).toBe(1);
    expect(context.endTargets).toEqual([context.TIME_ELAPSED_EXT]);

    expect(timer.poll()).toBeNull();
    context.finishLatest(5_000_000);
    expect(timer.poll()).toBe(5);

    // A consumed result is not reported twice and the query is replaced.
    expect(timer.poll()).toBeNull();
    expect(context.created).toHaveLength(2);
    expect(context.deleted).toHaveLength(1);
  });

  it("does not poll a query that is still recording", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    timer.begin();
    expect(timer.poll()).toBeNull();
    expect(context.endCalls).toBe(0);
    expect(context.created).toHaveLength(1);
    expect(context.deleted).toHaveLength(0);
  });

  it("does not start a second query while one is pending", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    timer.begin();
    timer.begin();
    expect(context.beginCalls).toBe(1);
    expect(context.created).toHaveLength(1);

    timer.end();
    timer.end();
    expect(context.endCalls).toBe(1);
  });

  it("discards the result when the GPU reports a disjoint event", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    timer.begin();
    timer.end();
    context.finishLatest(2_000_000);
    context.disjoint = true;

    expect(timer.poll()).toBeNull();
    expect(context.deleted).toHaveLength(1);
    expect(context.created).toHaveLength(2);

    context.disjoint = false;
    timer.begin();
    timer.end();
    context.finishLatest(3_000_000);
    expect(timer.poll()).toBe(3);
  });

  it("degrades to unsupported when a recycled query cannot be allocated", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    timer.begin();
    timer.end();
    context.finishLatest(4_000_000);
    context.failCreateQuery = true;

    // The completed result is still delivered; the failed replacement disables
    // further measurements so SceneManager can fall back.
    expect(timer.poll()).toBe(4);
    expect(timer.supported).toBe(false);
    expect(context.created).toHaveLength(1);

    timer.begin();
    expect(context.beginCalls).toBe(1);
    expect(timer.poll()).toBeNull();
  });

  it("reset ends recording, drops the pending query and allocates a fresh one", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    timer.begin();
    timer.reset();

    expect(context.endCalls).toBe(1);
    expect(context.deleted).toHaveLength(1);
    expect(context.deleted[0]).toBe(context.created[0]);
    expect(context.created).toHaveLength(2);
    expect(timer.supported).toBe(true);

    // The old query was already closed; a late end() must not close the new one.
    timer.end();
    expect(context.endCalls).toBe(1);
    expect(timer.poll()).toBeNull();

    timer.begin();
    expect(context.beginCalls).toBe(2);
    expect(context.activeQuery).toBe(context.created[1]);
    timer.end();
    context.finishLatest(6_000_000);
    expect(timer.poll()).toBe(6);
  });

  it("reset marks the timer unsupported when the replacement allocation fails", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);
    expect(timer.supported).toBe(true);

    context.failCreateQuery = true;
    timer.reset();

    expect(timer.supported).toBe(false);
    expect(context.deleted).toHaveLength(1);
    expect(context.deleted[0]).toBe(context.created[0]);
    timer.begin();
    expect(context.beginCalls).toBe(0);
    expect(timer.poll()).toBeNull();
  });

  it("deletes an ended query disposed before polling", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    timer.begin();
    timer.end();
    timer.dispose();

    expect(context.endCalls).toBe(1);
    expect(context.deleted).toHaveLength(1);
    expect(context.deleted[0]).toBe(context.created[0]);
    expect(timer.poll()).toBeNull();
  });

  it("deletes outstanding and idle queries on dispose, never null", () => {
    const context = new FakeWebGL2Context();
    const timer = createTimer(context);

    timer.begin();
    timer.dispose();
    expect(context.deleted).toHaveLength(1);
    expect(context.deleted[0]).toBe(context.created[0]);

    // dispose is idempotent and begin() stays inert afterwards.
    timer.dispose();
    expect(context.deleted).toHaveLength(1);
    expect(timer.poll()).toBeNull();
    timer.begin();
    expect(context.beginCalls).toBe(1);

    const idleContext = new FakeWebGL2Context();
    const idleTimer = createTimer(idleContext);
    idleTimer.dispose();
    expect(idleContext.deleted).toHaveLength(1);
    expect(idleContext.deleted[0]).toBe(idleContext.created[0]);
  });
});
