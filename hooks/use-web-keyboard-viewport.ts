import { useEffect } from "react";
import { Platform } from "react-native";

// iOS Safari doesn't resize the page when the on-screen keyboard opens; it only
// shrinks the visual viewport and scrolls the document. While the keyboard is
// open, size the app to the visible area so bottom buttons sit above it.
const KEYBOARD_THRESHOLD = 100;

export function useWebKeyboardViewport() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let appliedHeight: number | null = null;

    // Resetting the document scroll undoes Safari's own scroll to the focused
    // field, so scroll it into view inside the app's scroll container instead.
    const revealFocusedField = () => {
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.matches("input, textarea")) return;
      requestAnimationFrame(() => field.scrollIntoView({ block: "center" }));
    };

    const update = () => {
      const isKeyboardOpen = window.innerHeight - viewport.height > KEYBOARD_THRESHOLD;
      if (isKeyboardOpen) {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
        if (appliedHeight === viewport.height) return;
        appliedHeight = viewport.height;
        root.style.setProperty("--app-height", `${viewport.height}px`);
        revealFocusedField();
      } else if (appliedHeight !== null) {
        appliedHeight = null;
        root.style.removeProperty("--app-height");
      }
    };

    const onFocusIn = () => {
      if (appliedHeight !== null) revealFocusedField();
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
      root.style.removeProperty("--app-height");
    };
  }, []);
}
