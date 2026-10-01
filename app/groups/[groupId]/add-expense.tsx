import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { EmptyState } from "@/components/empty-state";
import { SharedExpenseForm } from "@/components/shared-expense-form";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";

export default function AddExpenseScreen() {
  const clay = useClayTheme();
  const insets = useSafeAreaInsets();
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const group = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const isLoading = useSharedGroupsStore((state) => state.isLoading);
  const userId = useSharedGroupsStore((state) => state.userId);

  // Dynamic layout measurement to guarantee edge-to-edge coverage on all screen sizes
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
  const fabLeft = (screenWidth - 56) / 2;
  const fabTop = screenHeight - fabBottom - 56;

  const openAnim = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);

  useEffect(() => {
    Animated.timing(openAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: false,
    }).start();
  }, [openAnim]);

  const handleClose = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;
    Animated.timing(openAnim, {
      toValue: 0,
      duration: 240,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: false,
    }).start(() => {
      router.back();
    });
  }, [openAnim]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  // Expanding geometry: 4-edge pinning guarantees 100% coverage (top: 0, bottom: 0, left: 0, right: 0)
  const animTop = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [fabTop, 0],
  });

  const animBottom = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [fabBottom, 0],
  });

  const animLeft = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [fabLeft, 0],
  });

  const animRight = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [fabLeft, 0],
  });

  const animRadius = openAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [28, 28, 0],
  });

  const backdropOpacity = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const fabOverlayOpacity = openAnim.interpolate({
    inputRange: [0, 0.15, 0.28],
    outputRange: [1, 0.5, 0],
  });

  const contentOpacity = openAnim.interpolate({
    inputRange: [0, 0.2, 0.6, 1],
    outputRange: [0, 0, 0.7, 1],
  });

  const contentTranslateY = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
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

      {/* ── Expanding Container: Starts as 56px circle at FAB position, completely covers the page ── */}
      <Animated.View
        style={{
          position: "absolute",
          top: animTop,
          bottom: animBottom,
          left: animLeft,
          right: animRight,
          borderRadius: animRadius,
          overflow: "hidden",
          backgroundColor: clay.canvas,
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 18,
        }}
      >
        {/* Full-screen content filling the container edge-to-edge */}
        <Animated.View
          style={{
            flex: 1,
            opacity: contentOpacity,
            transform: [{ translateY: contentTranslateY }],
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
                key={`${group.id}:${expenseId ?? "new"}`}
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

        {/* ── Initial FAB button morph layer (seamlessly matches the '+' button, then dissolves) ── */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: "center",
            justifyContent: "center",
            opacity: fabOverlayOpacity,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#F5D298",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="add" size={30} color={clay.heroText} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
