// ROLE: Wraps one in-flight EXT_disjoint_timer_query_webgl2 query and reports elapsed GPU milliseconds.
// Owns no render loop and does not know about the scene; unsupported contexts make it an inert no-op.

const EXTENSION_NAME = "EXT_disjoint_timer_query_webgl2";

/**
 * WebGL2 exposes the query API on the context (`gl.createQuery` & co); the
 * extension object only adds the target and disjoint constants. The DOM
 * typings do not guarantee the extension, so its shape is declared locally.
 */
interface DisjointTimerQueryExtension {
  readonly GPU_DISJOINT_EXT: number;
  readonly TIME_ELAPSED_EXT: number;
}

export class GpuTimer {
  private readonly gl: WebGL2RenderingContext;
  private readonly extension: DisjointTimerQueryExtension | null;
  /** Turns false when the context cannot allocate queries; callers then fall back. */
  private isSupported: boolean;
  /** Reused query, replaced after every completed or discarded measurement. */
  private query: WebGLQuery | null = null;
  /** The query that has been started and is waiting for a result. */
  private pending: WebGLQuery | null = null;
  /** True between a successful begin() and its end(); prevents double end/poll. */
  private recording = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.extension = GpuTimer.resolveExtension(gl);
    this.isSupported = this.extension !== null && GpuTimer.hasCoreQueryApi(gl);
    if (this.isSupported) this.query = this.createQuery();
  }

  public get supported(): boolean {
    return this.isSupported;
  }

  /** Starts a measurement only when there is no query already in flight. */
  public begin(): void {
    const extension = this.extension;
    if (!extension || !this.isSupported || this.recording || this.pending || !this.query) return;

    this.gl.beginQuery(extension.TIME_ELAPSED_EXT, this.query);
    this.pending = this.query;
    this.recording = true;
  }

  /** Closes the active measurement. Safe to call when begin() did not start one. */
  public end(): void {
    const extension = this.extension;
    if (!extension || !this.isSupported || !this.recording) return;

    // Clear the flag first: even a failed endQuery must not make us end twice.
    this.recording = false;
    this.gl.endQuery(extension.TIME_ELAPSED_EXT);
  }

  /**
   * Returns the last completed measurement in milliseconds, or null while the
   * result is unavailable, the GPU reports a disjoint event, or nothing is pending.
   */
  public poll(): number | null {
    const extension = this.extension;
    const pending = this.pending;
    if (!extension || !this.isSupported || !pending || this.recording) return null;

    const gl = this.gl;
    if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
      // Disjoint means the GPU was reset/reclocked: the result is meaningless.
      this.recycle(pending);
      return null;
    }

    if (!gl.getQueryParameter(pending, gl.QUERY_RESULT_AVAILABLE)) return null;

    const resultNs: unknown = gl.getQueryParameter(pending, gl.QUERY_RESULT);
    this.recycle(pending);

    if (typeof resultNs !== "number" || !Number.isFinite(resultNs) || resultNs <= 0) return null;
    return resultNs / 1e6;
  }

  /** Drops any in-flight measurement and starts over with a fresh query. */
  public reset(): void {
    const extension = this.extension;
    if (!extension || !GpuTimer.hasCoreQueryApi(this.gl)) {
      this.isSupported = false;
      return;
    }

    // A quality switch starts a new measurement period, so retry allocation
    // even if a previous createQuery() failed.
    this.isSupported = true;
    if (this.recording) {
      this.recording = false;
      this.gl.endQuery(extension.TIME_ELAPSED_EXT);
    }

    const pending = this.pending;
    const idle = this.query;
    this.pending = null;
    this.query = null;
    if (pending) this.gl.deleteQuery(pending);
    if (idle && idle !== pending) this.gl.deleteQuery(idle);

    this.query = this.createQuery();
  }

  public dispose(): void {
    const extension = this.extension;
    if (this.isSupported && this.recording && extension) {
      this.recording = false;
      this.gl.endQuery(extension.TIME_ELAPSED_EXT);
    }

    const pending = this.pending;
    const idle = this.query;
    this.pending = null;
    this.query = null;
    this.recording = false;
    if (!this.isSupported) return;

    if (pending) this.gl.deleteQuery(pending);
    if (idle && idle !== pending) this.gl.deleteQuery(idle);
  }

  private recycle(query: WebGLQuery): void {
    if (!this.isSupported) return;

    this.gl.deleteQuery(query);
    this.pending = null;
    this.query = this.createQuery();
  }

  private createQuery(): WebGLQuery | null {
    if (!this.isSupported) return null;

    const query = this.gl.createQuery();
    if (!query) this.isSupported = false;
    return query;
  }

  private static hasCoreQueryApi(gl: WebGL2RenderingContext): boolean {
    return (
      typeof gl.createQuery === "function" &&
      typeof gl.beginQuery === "function" &&
      typeof gl.endQuery === "function" &&
      typeof gl.getQueryParameter === "function" &&
      typeof gl.getParameter === "function" &&
      typeof gl.deleteQuery === "function"
    );
  }

  private static resolveExtension(gl: WebGL2RenderingContext): DisjointTimerQueryExtension | null {
    if (typeof gl.getExtension !== "function") return null;

    const candidate: unknown = gl.getExtension(EXTENSION_NAME);
    if (!candidate || typeof candidate !== "object") return null;

    const extension = candidate as Partial<DisjointTimerQueryExtension>;
    if (
      typeof extension.GPU_DISJOINT_EXT !== "number" ||
      typeof extension.TIME_ELAPSED_EXT !== "number"
    ) {
      return null;
    }

    return extension as DisjointTimerQueryExtension;
  }
}
