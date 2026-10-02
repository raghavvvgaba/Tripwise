import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { EmptyState } from "@/components/empty-state";
import { SharedExpenseForm } from "@/components/shared-expense-form";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import type { SharedGroup } from "@/types/shared-group";

export default function AddExpenseScreen() {
  const clay = useClayTheme();
  const insets = useSafeAreaInsets();
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const { groups, isLoading, userId } = useSharedGroups();
  const group = groups.find((item) => item.id === groupId);
  const isEdit = Boolean(expenseId);

  // If editing an existing expense, use standard page-to-page slide animation
  if (isEdit) {
    return (
      <EditExpenseView
        group={group}
        userId={userId}
        expenseId={expenseId!}
        isLoading={isLoading}
        clay={clay}
      />
    );
  }

  return (
    <NewExpenseBloomingView
      group={group}
      userId={userId}
      isLoading={isLoading}
      clay={clay}
      insets={insets}
    />
  );
}

// ─── Standard Page Navigation Transition for Edit Expense ───────────────────

function EditExpenseView({
  group,
  userId,
  expenseId,
  isLoading,
  clay,
}: {
  group: SharedGroup | undefined;
  userId: string | null;
  expenseId: string;
  isLoading: boolean;
  clay: ReturnType<typeof useClayTheme>;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const slideProgress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isClosing = useRef(false);

  useEffect(() => {
    slideProgress.value = withTiming(1, {
      duration: 280,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [slideProgress]);

  const handleClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    slideProgress.value = withTiming(
      0,
      {
        duration: 220,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(router.back)();
        }
      }
    );
  }, [slideProgress]);

  const closeScreenByDrag = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    dragY.value = withTiming(
      screenHeight,
      {
        duration: 220,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(router.back)();
        }
      }
    );
  }, [dragY, screenHeight]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderGrant: () => {
          cancelAnimation(dragY);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragY.value = gestureState.dy;
          } else {
            dragY.value = gestureState.dy * 0.15;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.5) {
            closeScreenByDrag();
          } else {
            dragY.value = withSpring(0, {
              damping: 24,
              stiffness: 260,
              mass: 0.8,
            });
          }
        },
        onPanResponderTerminate: () => {
          dragY.value = withSpring(0, {
            damping: 24,
            stiffness: 260,
            mass: 0.8,
          });
        },
      }),
    [closeScreenByDrag, dragY]
  );

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      slideProgress.value,
      [0, 1],
      [screenWidth, 0],
      Extrapolation.CLAMP
    );
    const dragScale = interpolate(
      dragY.value,
      [0, screenHeight],
      [1, 0.88],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX },
        { translateY: dragY.value },
        { scale: dragScale },
      ],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(
      slideProgress.value,
      [0, 1],
      [0, 0.3],
      Extrapolation.CLAMP
    );
    const dragMultiplier = interpolate(
      dragY.value,
      [0, screenHeight * 0.6],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: baseOpacity * dragMultiplier,
    };
  });

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      {/* ── Dimmed Backdrop ── */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000",
          },
          backdropAnimatedStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* ── Standard Page Slide In From Right + Drag Down to dismiss ── */}
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: clay.canvas,
          },
          containerAnimatedStyle,
        ]}
      >
        {group ? (
          group.deletedAt || !userId ? (
            <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
              <ScrollView contentContainerClassName="px-5 py-8">
                <EmptyState icon="trash-outline" title="Expense unavailable" message="Restore this group before adding an expense." />
              </ScrollView>
            </SafeAreaView>
          ) : (
            <SharedExpenseForm
              key={`${group.id}:${expenseId}`}
              group={group}
              currentUserId={userId}
              expenseId={expenseId}
              onClose={handleClose}
              headerPanHandlers={panResponder.panHandlers}
            />
          )
        ) : isLoading ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#F5D298" size="large" />
            </View>
          </SafeAreaView>
        ) : (
          <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
            <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
              <EmptyState icon="search-outline" title="Group not found" message="Return to your groups and try again." />
            </ScrollView>
          </SafeAreaView>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Blooming '+' Button Animation for New Expense ──────────────────────────

function NewExpenseBloomingView({
  group,
  userId,
  isLoading,
  clay,
  insets,
}: {
  group: SharedGroup | undefined;
  userId: string | null;
  isLoading: boolean;
  clay: ReturnType<typeof useClayTheme>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [layout, setLayout] = useState<{ width: number; height: number }>(() => {
    const screen = Dimensions.get("screen");
    return { width: screen.width, height: screen.height };
  });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    }
  }, []);

  const screenWidth = layout.width;
  const screenHeight = layout.height;

  // Floating '+' button coordinates on the underlying group screen
  const fabBottom = Math.max(insets.bottom, 16) + 16;
  const fabCenterY = screenHeight - fabBottom - 28;
  const initialTranslateY = fabCenterY - screenHeight / 2;
  const initialScaleX = Math.min(1, 56 / Math.max(1, screenWidth));
  const initialScaleY = Math.min(1, 56 / Math.max(1, screenHeight));

  const openProgress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const isClosing = useRef(false);

  useEffect(() => {
    openProgress.value = withTiming(1, {
      duration: 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [openProgress]);

  const handleClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    openProgress.value = withTiming(
      0,
      {
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(router.back)();
        }
      }
    );
  }, [openProgress]);

  const closeScreenByDrag = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    dragY.value = withTiming(
      screenHeight,
      {
        duration: 220,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(router.back)();
        }
      }
    );
  }, [dragY, screenHeight]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderGrant: () => {
          cancelAnimation(dragY);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragY.value = gestureState.dy;
          } else {
            dragY.value = gestureState.dy * 0.15;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 0.5) {
            closeScreenByDrag();
          } else {
            dragY.value = withSpring(0, {
              damping: 24,
              stiffness: 260,
              mass: 0.8,
            });
          }
        },
        onPanResponderTerminate: () => {
          dragY.value = withSpring(0, {
            damping: 24,
            stiffness: 260,
            mass: 0.8,
          });
        },
      }),
    [closeScreenByDrag, dragY]
  );

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const bloomTranslateY = interpolate(
      openProgress.value,
      [0, 1],
      [initialTranslateY, 0],
      Extrapolation.CLAMP
    );
    const bloomScaleX = interpolate(
      openProgress.value,
      [0, 1],
      [initialScaleX, 1],
      Extrapolation.CLAMP
    );
    const bloomScaleY = interpolate(
      openProgress.value,
      [0, 1],
      [initialScaleY, 1],
      Extrapolation.CLAMP
    );

    const dragScale = interpolate(
      dragY.value,
      [0, screenHeight],
      [1, 0.88],
      Extrapolation.CLAMP
    );

    const translateY = bloomTranslateY + dragY.value;
    const scaleX = bloomScaleX * dragScale;
    const scaleY = bloomScaleY * dragScale;

    const cardOpacity = interpolate(
      openProgress.value,
      [0, 0.04, 1],
      [0, 1, 1],
      Extrapolation.CLAMP
    );

    const borderRadius = interpolate(
      openProgress.value,
      [0, 1],
      [28, 24],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }, { scaleX }, { scaleY }],
      opacity: cardOpacity,
      borderRadius,
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(
      openProgress.value,
      [0, 1],
      [0, 0.45],
      Extrapolation.CLAMP
    );
    const dragMultiplier = interpolate(
      dragY.value,
      [0, screenHeight * 0.6],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: baseOpacity * dragMultiplier,
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      openProgress.value,
      [0, 0.45, 0.8, 1],
      [0, 0, 0.7, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
    };
  });

  return (
    <View onLayout={onLayout} style={{ flex: 1, backgroundColor: "transparent" }}>
      {/* ── Dimmed Backdrop over the underlying group screen ── */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000",
          },
          backdropAnimatedStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* ── Expanding Container: GPU-accelerated transforms with Reanimated ── */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: clay.canvas,
            elevation: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 18,
          },
          containerAnimatedStyle,
        ]}
      >
        <Animated.View style={[{ flex: 1 }, contentAnimatedStyle]}>
          {group ? (
            group.deletedAt || !userId ? (
              <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
                <ScrollView contentContainerClassName="px-5 py-8">
                  <EmptyState icon="trash-outline" title="Expense unavailable" message="Restore this group before adding an expense." />
                </ScrollView>
              </SafeAreaView>
            ) : (
              <SharedExpenseForm
                key={`${group.id}:new`}
                group={group}
                currentUserId={userId}
                onClose={handleClose}
                headerPanHandlers={panResponder.panHandlers}
              />
            )
          ) : isLoading ? (
            <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#F5D298" size="large" />
              </View>
            </SafeAreaView>
          ) : (
            <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
              <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
                <EmptyState icon="search-outline" title="Group not found" message="Return to your groups and try again." />
              </ScrollView>
            </SafeAreaView>
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}
