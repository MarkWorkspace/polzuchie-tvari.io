// ROLE: Reusable modal focus trap (initial focus, Tab cycling, focus restore). No dialog markup or game state.
import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/** The topmost trap owns Escape/Tab while several dialogs can be mounted. */
const trapStack: symbol[] = [];

function isNegativeTabIndex(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute("tabindex");
  return tabIndex !== null && Number(tabIndex) < 0;
}

function isHidden(element: HTMLElement, boundary: HTMLElement): boolean {
  let node: HTMLElement | null = element;
  while (node) {
    if (node.hidden || node.hasAttribute("inert")) return true;
    if (node.getAttribute("aria-hidden") === "true") return true;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return true;
    if (node === boundary) break;
    node = node.parentElement;
  }
  return false;
}

/** Focusable descendants in DOM order, ignoring disabled, inert and hidden nodes. */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      !isHidden(element, container) &&
      !isNegativeTabIndex(element),
  );
}

export type FocusTarget = RefObject<HTMLElement | null> | (() => HTMLElement | null | undefined);

export interface FocusTrapOptions {
  /** Defaults to true. When false the trap is inert and focus restore does not run. */
  enabled?: boolean;
  /** Element focused on activation. Defaults to the first focusable descendant. */
  initialFocus?: FocusTarget;
  /** Restore the element focused before activation. Defaults to true. */
  restoreFocus?: boolean;
  /** Called on Escape; omit it to leave Escape to the surrounding app. */
  onEscape?: () => void;
}

function resolveTarget(target: FocusTarget | undefined): HTMLElement | null {
  if (!target) return null;
  return typeof target === "function" ? (target() ?? null) : target.current;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: FocusTrapOptions = {},
): void {
  const { enabled = true, initialFocus, restoreFocus = true, onEscape } = options;
  const initialFocusRef = useRef(initialFocus);
  const restoreFocusRef = useRef(restoreFocus);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    initialFocusRef.current = initialFocus;
    restoreFocusRef.current = restoreFocus;
    onEscapeRef.current = onEscape;
  }, [initialFocus, restoreFocus, onEscape]);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const trapId = Symbol("focus-trap");
    trapStack.push(trapId);

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const explicit = resolveTarget(initialFocusRef.current);
    const initial =
      explicit && container.contains(explicit) && !explicit.hasAttribute("disabled")
        ? explicit
        : getFocusableElements(container)[0];
    initial?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (trapStack[trapStack.length - 1] !== trapId) return;

      if (event.key === "Escape") {
        if (!onEscapeRef.current) return;
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const currentIndex = active instanceof HTMLElement ? focusable.indexOf(active) : -1;

      if (currentIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && currentIndex === 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      const stackIndex = trapStack.indexOf(trapId);
      if (stackIndex !== -1) trapStack.splice(stackIndex, 1);

      if (
        restoreFocusRef.current &&
        previousFocus &&
        previousFocus !== document.body &&
        previousFocus.isConnected
      ) {
        previousFocus.focus();
      }
    };
  }, [containerRef, enabled]);
}
