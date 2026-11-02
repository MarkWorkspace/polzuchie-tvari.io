// @vitest-environment jsdom
// ROLE: Tests for the reusable modal focus trap and its focusable-element helper.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getFocusableElements, useFocusTrap } from "./useFocusTrap";

afterEach(cleanup);

function buildContainer(): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <a href="#one">Link</a>
    <button>Button</button>
    <button disabled>Disabled</button>
    <input type="hidden" />
    <div style="display: none"><button>Hidden parent</button></div>
    <button hidden>Hidden</button>
    <button aria-hidden="true">Aria hidden</button>
    <div inert><button>Inert</button></div>
    <button tabindex="-1">Tab minus one</button>
    <span tabindex="0">Tabindex</span>
  `;
  document.body.appendChild(container);
  return container;
}

interface TrapHarnessProps {
  enabled?: boolean;
  onEscape?: () => void;
}

function TrapHarness({ enabled = true, onEscape }: TrapHarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(containerRef, { enabled, initialFocus: firstRef, onEscape });

  return (
    <div ref={containerRef} data-testid="trap">
      <button ref={firstRef} type="button">
        First
      </button>
      <button type="button">Middle</button>
      <button type="button">Last</button>
    </div>
  );
}

function ClosingHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="outside">
        Outside
      </button>
      {open ? <TrapHarness onEscape={() => setOpen(false)} /> : null}
    </>
  );
}

describe("getFocusableElements", () => {
  it("returns visible, enabled elements in DOM order", () => {
    const container = buildContainer();

    try {
      expect(getFocusableElements(container).map((element) => element.textContent)).toEqual([
        "Link",
        "Button",
        "Tabindex",
      ]);
    } finally {
      container.remove();
    }
  });

  it("returns nothing for a null or hidden container", () => {
    expect(getFocusableElements(null)).toEqual([]);

    const container = buildContainer();
    container.style.display = "none";
    try {
      expect(getFocusableElements(container)).toEqual([]);
    } finally {
      container.remove();
    }
  });
});

describe("useFocusTrap", () => {
  it("focuses the initial element and wraps Tab forward and backward", () => {
    render(<TrapHarness />);

    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    // Non-boundary Tab is left to the browser's native order.
    const middle = screen.getByRole("button", { name: "Middle" });
    middle.focus();
    expect(fireEvent.keyDown(middle, { key: "Tab" })).toBe(true);
  });

  it("does not intercept keys while disabled", () => {
    render(<TrapHarness enabled={false} />);

    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    last.focus();

    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).not.toHaveFocus();
    expect(last).toHaveFocus();
  });

  it("calls onEscape while the trap is active", () => {
    const onEscape = vi.fn();
    render(<TrapHarness onEscape={onEscape} />);

    fireEvent.keyDown(screen.getByRole("button", { name: "First" }), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("restores the previously focused element on unmount", () => {
    const sentinel = document.createElement("button");
    sentinel.textContent = "sentinel";
    document.body.appendChild(sentinel);
    sentinel.focus();

    try {
      const { unmount } = render(<TrapHarness />);
      expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

      unmount();
      expect(sentinel).toHaveFocus();
    } finally {
      sentinel.remove();
    }
  });

  it("restores focus when the trap closes through state", () => {
    render(<ClosingHarness />);
    const outside = screen.getByTestId("outside");
    outside.focus();
    fireEvent.click(outside);
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("button", { name: "First" }), { key: "Escape" });
    expect(outside).toHaveFocus();
  });
});
