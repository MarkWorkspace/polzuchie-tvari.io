// ROLE: Cross-tab ownership of the player session via Web Locks and BroadcastChannel. Not network, UI or game logic.

const DEFAULT_SESSION_NAME = "snake-player-session";
const TAKE_OVER_MESSAGE = "TAKE_OVER";

export class PlayerSessionLock {
  private readonly lockName: string;
  private readonly channel: BroadcastChannel | null;
  private releaseHold: (() => void) | null = null;
  private takeOverHandler: (() => void) | null = null;
  private takenOver = false;

  constructor(lockName: string = DEFAULT_SESSION_NAME) {
    this.lockName = lockName;
    this.channel = this.createChannel(lockName);
    this.channel?.addEventListener("message", this.handleChannelMessage);
  }

  public get supported(): boolean {
    return Boolean(this.channel) && typeof navigator !== "undefined" && "locks" in navigator;
  }

  /** Try to take the lock without waiting. Returns false when another tab owns it. */
  public async tryAcquire(): Promise<boolean> {
    if (!this.supported) return true;
    try {
      return await this.requestLock(true);
    } catch (error) {
      console.warn("[SessionLock] Web Locks unavailable; continuing without it", error);
      return true;
    }
  }

  /** Wait up to timeoutMs for the current owner to release the lock. */
  public async acquireWhenAvailable(timeoutMs: number): Promise<boolean> {
    if (!this.supported) return true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.requestLock(false, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      console.warn("[SessionLock] Failed to acquire the session lock", error);
      return true;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  /** Ask the current owner tab to release the lock and stop its game. */
  public requestTakeOver(): void {
    this.channel?.postMessage({ type: TAKE_OVER_MESSAGE });
  }

  public onTakeOver(handler: () => void): void {
    this.takeOverHandler = handler;
  }

  public release(): void {
    this.releaseHold?.();
    this.releaseHold = null;
  }

  public dispose(): void {
    this.release();
    if (this.channel) {
      this.channel.removeEventListener("message", this.handleChannelMessage);
      this.channel.close();
    }
    this.takeOverHandler = null;
  }

  private requestLock(ifAvailable: boolean, signal?: AbortSignal): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      let release: () => void = () => {};
      const hold = new Promise<void>((resolveHold) => {
        release = resolveHold;
      });
      const request = navigator.locks.request(
        this.lockName,
        { mode: "exclusive", ifAvailable, signal },
        async (lock) => {
          if (!lock) {
            resolve(false);
            return;
          }
          this.releaseHold = release;
          resolve(true);
          await hold;
          this.releaseHold = null;
        },
      );
      request.catch((error) => {
        this.releaseHold = null;
        reject(error);
      });
    });
  }

  private createChannel(name: string): BroadcastChannel | null {
    if (typeof BroadcastChannel === "undefined") return null;
    try {
      return new BroadcastChannel(name);
    } catch {
      return null;
    }
  }

  private handleChannelMessage = (event: MessageEvent): void => {
    if (event.data?.type !== TAKE_OVER_MESSAGE || this.takenOver) return;
    this.takenOver = true;
    this.takeOverHandler?.();
  };
}
