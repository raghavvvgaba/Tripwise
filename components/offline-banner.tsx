import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeColors } from "@/constants/theme";
import { useNetworkStore } from "@/store/use-network-store";

const SLIDE_OFFSET = 140;

// Gap above the bottom edge on other screens, clearing the group screen's add button.
const ABOVE_ADD_BUTTON = 84;
// Native draws its 64px tab bar inside the tab screens; the web shell draws its nav outside them.
const ABOVE_TAB_BAR = Platform.OS === "web" ? 12 : 64 + 12;

export function OfflineBanner({ aboveTabBar = false }: { aboveTabBar?: boolean }) {
  const isOnline = useNetworkStore((state) => state.isOnline);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();

  const [showOnline, setShowOnline] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useNetworkStore.subscribe((state, previous) => {
      if (state.isOnline === previous.isOnline) return;
      clearTimeout(hideTimer);
      if (state.isOnline === true && previous.isOnline === false) {
        setShowOnline(true);
        hideTimer = setTimeout(() => setShowOnline(false), 2000);
      } else {
        setShowOnline(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(hideTimer);
    };
  }, []);

  const offline = isOnline === false;
  const isVisible = offline || (isOnline === true && showOnline);

  const [isRendered, setIsRendered] = useState(isVisible);
  const isVisibleRef = useRef(isVisible);

  if (isVisible && !isRendered) {
    setIsRendered(true);
  }

  const translateY = useSharedValue(isVisible ? 0 : SLIDE_OFFSET);
  const opacity = useSharedValue(isVisible ? 1 : 0);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    if (isVisible) {
      translateY.value = withTiming(0, {
        duration: reducedMotion ? 0 : 240,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      opacity.value = withTiming(1, {
        duration: reducedMotion ? 0 : 200,
        easing: Easing.out(Easing.ease),
      });
    } else if (isRendered) {
      translateY.value = withTiming(
        SLIDE_OFFSET,
        {
          duration: reducedMotion ? 0 : 200,
          easing: Easing.bezier(0.7, 0, 0.84, 0),
        },
        (finished) => {
          if (finished && !isVisibleRef.current) {
            runOnJS(setIsRendered)(false);
          }
        }
      );
      opacity.value = withTiming(0, {
        duration: reducedMotion ? 0 : 180,
        easing: Easing.in(Easing.ease),
      });
    }
  }, [isVisible, isRendered, opacity, reducedMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isRendered) return null;

  const statusColor = offline ? colors.coral : colors.positive;

  // Position on a plain View: Reanimated's Animated.View drops className on web.
  return (
    <View
      pointerEvents="none"
      className="offline-banner"
      style={{ bottom: aboveTabBar ? insets.bottom + ABOVE_TAB_BAR : Math.max(insets.bottom, 16) + ABOVE_ADD_BUTTON }}
    >
      <Animated.View style={animatedStyle}>
        <View
          className={`offline-banner__content ${offline ? "border-coral" : "border-positive"}`}
          accessible
          accessibilityLabel={offline ? "You’re offline. Check your internet connection." : "You’re back online."}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Ionicons
            name={offline ? "cloud-offline-outline" : "cloud-done-outline"}
            size={14}
            color={statusColor}
          />
          <Text className={`text-xs font-semibold leading-4 ${offline ? "text-coral" : "text-positive"}`}>
            {offline ? "Offline" : "Online"}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
