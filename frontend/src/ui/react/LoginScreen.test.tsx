// @vitest-environment jsdom
// ROLE: Regression tests for the React game login screen and cross-tab conflict flow.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen, type PlayResult, type TakeOverResult } from "./LoginScreen";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function renderLogin(
  overrides: {
    onPlay?: (nickname: string, skin: string) => Promise<PlayResult>;
    onTakeOver?: (nickname: string, skin: string) => Promise<TakeOverResult>;
    onSpectate?: () => void;
  } = {},
) {
  const onPlay = vi.fn<(nickname: string, skin: string) => Promise<PlayResult>>(
    overrides.onPlay ?? (async () => "started"),
  );
  const onTakeOver = vi.fn<(nickname: string, skin: string) => Promise<TakeOverResult>>(
    overrides.onTakeOver ?? (async () => "started"),
  );
  const onSpectate = vi.fn<() => void>(overrides.onSpectate ?? (() => {}));
  render(<LoginScreen onPlay={onPlay} onTakeOver={onTakeOver} onSpectate={onSpectate} />);
  return { onPlay, onTakeOver, onSpectate };
}

describe("LoginScreen", () => {
  it("saves the nickname and starts the game", async () => {
    const { onPlay } = renderLogin();

    fireEvent.change(screen.getByLabelText("Your nickname"), {
      target: { value: "  TestSnake  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => expect(onPlay).toHaveBeenCalledWith("TestSnake", "#22c55e"));
    expect(localStorage.getItem("snake-nickname")).toBe("TestSnake");
  });

  it("remembers the selected skin for the next visit", async () => {
    const { onPlay } = renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(onPlay).toHaveBeenCalledWith("Player", "#ef4444"));

    cleanup();
    renderLogin();
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers takeover when another tab owns the session", async () => {
    const { onTakeOver } = renderLogin({
      onPlay: async () => "busy",
      onTakeOver: async () => "timeout",
    });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(
      await screen.findByRole("heading", { name: "Game is already open in another tab" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Play here" }));

    await waitFor(() => expect(onTakeOver).toHaveBeenCalledWith("Player", "#22c55e"));
    expect(await screen.findByRole("alert")).toHaveTextContent("not responding");
  });

  it("can switch to spectator mode from the conflict screen", async () => {
    const { onSpectate } = renderLogin({ onPlay: async () => "busy" });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("heading", { name: "Game is already open in another tab" });
    fireEvent.click(screen.getByRole("button", { name: "Spectate" }));

    expect(onSpectate).toHaveBeenCalled();
  });
});
