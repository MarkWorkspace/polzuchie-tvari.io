// ROLE: Throttled window-event adapter and external store for React game UI. No rendering or game logic.
import { useSyncExternalStore } from "react";
import type { ControlMode } from "../../game/InputManager";
import type { NetworkStatus } from "../../game/NetworkManager";
import type { TranslationKey } from "../../lib/i18n";

export interface GameStatusState {
  status: NetworkStatus;
  msg?: string;
  msgKey?: TranslationKey;
  msgParams?: Record<string, unknown>;
  controlMode: ControlMode;
}

export interface ScoreFeedItem {
  id: number;
  delta: number;
}

export interface ScoreState {
  score: number;
  feed: ScoreFeedItem[];
}

export interface LeaderboardEntry {
  id: string;
  nickname?: string;
  score: number;
  kills: number;
  deaths: number;
  isMe: boolean;
}

export interface KillFeedItem {
  id: number;
  killer: string | null;
  victim: string;
}

interface GameStatusEventDetail {
  status: NetworkStatus;
  msg?: string;
  msgKey?: string;
  msgParams?: Record<string, unknown>;
  controlMode?: ControlMode;
}

interface ScoreEventDetail {
  score: number;
  delta: number;
}

interface KillFeedEventDetail {
  events: Array<{ killer: string; victim: string }>;
  players: Record<string, { nickname?: string } | undefined>;
}

const INITIAL_STATUS: GameStatusState = { status: "connecting", controlMode: "keyboard" };
const INITIAL_SCORE: ScoreState = { score: 0, feed: [] };
const INITIAL_LEADERBOARD: LeaderboardEntry[] = [];
const INITIAL_KILL_FEED: KillFeedItem[] = [];

const SCORE_THROTTLE_MS = 100;
const LEADERBOARD_THROTTLE_MS = 250;
const SCORE_FEED_LIFETIME_MS = 1500;
const KILL_FEED_LIFETIME_MS = 5000;
const KILL_FEED_LIMIT = 5;

export interface ReadonlyStore<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

class StoreSlice<T> implements ReadonlyStore<T> {
  private value: T;
  private readonly throttleMs: number;
  private pending: { value: T } | null = null;
  private timer: number | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T, throttleMs: number) {
    this.value = initial;
    this.throttleMs = throttleMs;
  }

  public getSnapshot = (): T => this.value;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public set(next: T): void {
    if (this.pending) {
      if (Object.is(next, this.pending.value)) return;
    } else if (Object.is(next, this.value)) {
      return;
    }

    this.pending = { value: next };
    if (this.throttleMs <= 0) {
      this.flush();
      return;
    }
    if (this.timer === null) {
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.flush();
      }, this.throttleMs);
    }
  }

  public update(updater: (previous: T) => T): void {
    this.set(updater(this.pending ? this.pending.value : this.value));
  }

  public reset(initial: T): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
    if (Object.is(initial, this.value)) return;
    this.value = initial;
    this.emit();
  }

  private flush(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    const pending = this.pending;
    this.pending = null;
    if (!pending || Object.is(pending.value, this.value)) return;
    this.value = pending.value;
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

const statusSlice = new StoreSlice<GameStatusState>(INITIAL_STATUS, 0);
const pingSlice = new StoreSlice<number | null>(null, 0);
const scoreSlice = new StoreSlice<ScoreState>(INITIAL_SCORE, SCORE_THROTTLE_MS);
const leaderboardSlice = new StoreSlice<LeaderboardEntry[]>(
  INITIAL_LEADERBOARD,
  LEADERBOARD_THROTTLE_MS,
);
const killFeedSlice = new StoreSlice<KillFeedItem[]>(INITIAL_KILL_FEED, 0);

export const gameUi = {
  status: statusSlice as ReadonlyStore<GameStatusState>,
  ping: pingSlice as ReadonlyStore<number | null>,
  score: scoreSlice as ReadonlyStore<ScoreState>,
  leaderboard: leaderboardSlice as ReadonlyStore<LeaderboardEntry[]>,
  killFeed: killFeedSlice as ReadonlyStore<KillFeedItem[]>,
};

let nextItemId = 1;
const expiryTimers = new Set<number>();

function scheduleExpiry(callback: () => void, delayMs: number): void {
  const timer = window.setTimeout(() => {
    expiryTimers.delete(timer);
    callback();
  }, delayMs);
  expiryTimers.add(timer);
}

function clearExpiryTimers(): void {
  for (const timer of expiryTimers) window.clearTimeout(timer);
  expiryTimers.clear();
}

function handleStatus(event: Event): void {
  const detail = (event as CustomEvent<GameStatusEventDetail>).detail;
  statusSlice.set({
    status: detail.status,
    msg: detail.msg,
    msgKey: detail.msgKey as TranslationKey | undefined,
    msgParams: detail.msgParams,
    controlMode: detail.controlMode ?? "keyboard",
  });
}

function handlePing(event: Event): void {
  pingSlice.set((event as CustomEvent<number>).detail);
}

function handleScore(event: Event): void {
  const detail = (event as CustomEvent<ScoreEventDetail>).detail;
  const feedItem =
    detail.delta === 0
      ? null
      : {
          id: nextItemId++,
          delta: detail.delta,
        };

  scoreSlice.update((previous) => ({
    score: detail.score,
    feed: feedItem ? [...previous.feed, feedItem].slice(-3) : previous.feed,
  }));

  if (!feedItem) return;
  scheduleExpiry(() => {
    scoreSlice.update((previous) => {
      if (!previous.feed.some((item) => item.id === feedItem.id)) return previous;
      return { ...previous, feed: previous.feed.filter((item) => item.id !== feedItem.id) };
    });
  }, SCORE_FEED_LIFETIME_MS);
}

function handleLeaderboard(event: Event): void {
  leaderboardSlice.set((event as CustomEvent<LeaderboardEntry[]>).detail ?? []);
}

function handleKillFeed(event: Event): void {
  const { events, players } = (event as CustomEvent<KillFeedEventDetail>).detail;
  if (!events || events.length === 0) return;

  const items = events.map((kill) => ({
    id: nextItemId++,
    killer: kill.killer ? players?.[kill.killer]?.nickname || kill.killer : null,
    victim: players?.[kill.victim]?.nickname || kill.victim,
  }));

  killFeedSlice.update((previous) => [...previous, ...items].slice(-KILL_FEED_LIMIT));

  const ids = new Set(items.map((item) => item.id));
  scheduleExpiry(() => {
    killFeedSlice.update((previous) => {
      if (!previous.some((item) => ids.has(item.id))) return previous;
      return previous.filter((item) => !ids.has(item.id));
    });
  }, KILL_FEED_LIFETIME_MS);
}

let detachBridge: (() => void) | null = null;

/** Reset the store and connect it to window game events. Returns a cleanup function. */
export function attachGameUiBridge(): () => void {
  detachBridge?.();

  clearExpiryTimers();
  nextItemId = 1;
  statusSlice.reset(INITIAL_STATUS);
  pingSlice.reset(null);
  scoreSlice.reset(INITIAL_SCORE);
  leaderboardSlice.reset(INITIAL_LEADERBOARD);
  killFeedSlice.reset(INITIAL_KILL_FEED);

  window.addEventListener("game-status", handleStatus);
  window.addEventListener("game-ping", handlePing);
  window.addEventListener("game-score-update", handleScore);
  window.addEventListener("game-leaderboard", handleLeaderboard);
  window.addEventListener("game-killfeed", handleKillFeed);

  const detach = () => {
    window.removeEventListener("game-status", handleStatus);
    window.removeEventListener("game-ping", handlePing);
    window.removeEventListener("game-score-update", handleScore);
    window.removeEventListener("game-leaderboard", handleLeaderboard);
    window.removeEventListener("game-killfeed", handleKillFeed);
    clearExpiryTimers();
    if (detachBridge === detach) detachBridge = null;
  };
  detachBridge = detach;
  return detach;
}

export function useGameStatus(): GameStatusState {
  return useSyncExternalStore(statusSlice.subscribe, statusSlice.getSnapshot);
}

export function useGamePing(): number | null {
  return useSyncExternalStore(pingSlice.subscribe, pingSlice.getSnapshot);
}

export function useGameScore(): ScoreState {
  return useSyncExternalStore(scoreSlice.subscribe, scoreSlice.getSnapshot);
}

export function useGameLeaderboard(): LeaderboardEntry[] {
  return useSyncExternalStore(leaderboardSlice.subscribe, leaderboardSlice.getSnapshot);
}

export function useGameKillFeed(): KillFeedItem[] {
  return useSyncExternalStore(killFeedSlice.subscribe, killFeedSlice.getSnapshot);
}
