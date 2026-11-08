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

    const update = () => {
      const isKeyboardOpen = window.innerHeight - viewport.height > KEYBOARD_THRESHOLD;
      if (isKeyboardOpen) {
        root.style.setProperty("--app-height", `${viewport.height}px`);
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      } else {
        root.style.removeProperty("--app-height");
      }
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--app-height");
    };
  }, []);
}
