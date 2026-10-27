// @vitest-environment jsdom
// ROLE: Regression tests for the React game login screen.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen";

afterEach(cleanup);

describe("LoginScreen", () => {
  it("saves the nickname and starts the game", () => {
    const onPlay = vi.fn();
    render(<LoginScreen onPlay={onPlay} />);

    fireEvent.change(screen.getByLabelText("Your nickname"), {
      target: { value: "  TestSnake  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(onPlay).toHaveBeenCalledWith("TestSnake", "#22c55e");
    expect(localStorage.getItem("snake-nickname")).toBe("TestSnake");
  });
});
