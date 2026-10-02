import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
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
  const { width: screenWidth } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const useNative = Platform.OS !== "web";

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: useNative,
    }).start();
  }, [slideAnim, useNative]);

  const handleClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: useNative,
    }).start(() => {
      router.back();
    });
  }, [slideAnim, useNative]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  const animTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenWidth, 0],
  });

  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      {/* ── Dimmed Backdrop ── */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          opacity: backdropOpacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* ── Standard Page Slide In From Right (GPU Accelerated) ── */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: clay.canvas,
          transform: [{ translateX: animTranslateX }],
        }}
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
  // Dynamic screen dimensions to adapt to any device size or orientation
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

  const openAnim = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const useNative = Platform.OS !== "web";

  useEffect(() => {
    Animated.timing(openAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: useNative,
    }).start();
  }, [openAnim, useNative]);

  const handleClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Keyboard.dismiss();
    Animated.timing(openAnim, {
      toValue: 0,
      duration: 240,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: useNative,
    }).start(() => {
      router.back();
    });
  }, [openAnim, useNative]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  // Native GPU transforms: scaleX, scaleY, and translateY run 100% on the compositor thread
  const animTranslateY = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [initialTranslateY, 0],
  });

  const animScaleX = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [initialScaleX, 1],
  });

  const animScaleY = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [initialScaleY, 1],
  });

  const backdropOpacity = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  // Card opacity: dissolves seamlessly into the real underlying button at the end of closing
  const cardOpacity = openAnim.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 1, 1],
  });

  // Fast content fade-out on close: drops to 0 in the first ~70ms to eliminate layout thrashing
  const contentOpacity = openAnim.interpolate({
    inputRange: [0, 0.45, 0.8, 1],
    outputRange: [0, 0, 0.7, 1],
  });

  return (
    <View onLayout={onLayout} style={{ flex: 1, backgroundColor: "transparent" }}>
      {/* ── Dimmed Backdrop over the underlying group screen ── */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#000",
          opacity: backdropOpacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
      </Animated.View>

      {/* ── Expanding Container: GPU-accelerated transforms for 60/120 FPS ── */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: clay.canvas,
          opacity: cardOpacity,
          transform: [
            { translateY: animTranslateY },
            { scaleX: animScaleX },
            { scaleY: animScaleY },
          ],
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 18,
        }}
      >
        {/* Full-screen content that quickly fades out on close */}
        <Animated.View style={{ flex: 1, opacity: contentOpacity }}>
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
