import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

const EXIT_DURATION_MS = 180;

export function RouteModal({ title, children }: { title: string; children: (dismiss: () => void) => ReactNode }) {
  const [isClosing, setIsClosing] = useState(false);
  const closing = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setIsClosing(true);
    timeout.current = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }, EXIT_DURATION_MS);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [dismiss]);

  return (
    <View className={`route-modal ${isClosing ? "route-modal--closing" : ""}`}>
      <Pressable accessibilityLabel={`Close ${title}`} onPress={dismiss} className="absolute inset-0" />
      <View className="route-modal__dialog bg-canvas">
        <View className="flex-row items-center justify-between border-b border-line px-5 py-3 md:px-8">
          <Text className="text-lg font-semibold text-ink">{title}</Text>
          <Pressable accessibilityLabel={`Close ${title}`} accessibilityRole="button" onPress={dismiss} className="h-10 w-10 items-center justify-center rounded-full hover:bg-line">
            <Text className="text-2xl font-light text-ink">×</Text>
          </Pressable>
        </View>
        {children(dismiss)}
      </View>
    </View>
  );
}
