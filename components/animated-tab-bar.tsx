import { BottomTabBar, type BottomTabBarButtonProps, type BottomTabBarProps } from "expo-router/tabs";
import { useState, type Ref } from "react";
import { I18nManager, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useClayTheme } from "@/constants/clay-theme";

export function AnimatedTabBar(props: BottomTabBarProps) {
  const activeKey = props.state.routes[props.state.index].key;
  const activeDescriptor = props.descriptors[activeKey];

  return (
    <BottomTabBar
      {...props}
      descriptors={{
        ...props.descriptors,
        [activeKey]: {
          ...activeDescriptor,
          options: {
            ...activeDescriptor.options,
            tabBarBackground: () => (
              <TabHighlight
                index={props.state.index}
                count={props.state.routes.length}
              />
            ),
          },
        },
      }}
    />
  );
}

function TabHighlight({ index, count }: { index: number; count: number }) {
  const [width, setWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const clay = useClayTheme();
  const slotWidth = width / count;
  const pillWidth = Math.min(64, Math.max(0, slotWidth - 16));
  const position = (I18nManager.isRTL ? count - 1 - index : index) * slotWidth + (slotWidth - pillWidth) / 2;
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(position, { duration: reducedMotion ? 0 : 200 }) }],
  }));

  return (
    <View className="flex-1" pointerEvents="none" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Animated.View
          className="absolute left-0 top-3 h-8 rounded-full"
          style={[
            { width: pillWidth, backgroundColor: clay.squircle },
            animatedStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

export function AnimatedTabButton({ children, style, onPressIn, onPressOut, ref, ...props }: BottomTabBarButtonProps) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View className="flex-1" style={animatedStyle}>
      <Pressable
        {...props}
        ref={ref as Ref<View>}
        style={style}
        onPressIn={(event) => {
          scale.set(withTiming(reducedMotion ? 1 : 0.96, { duration: 100 }));
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withTiming(1, { duration: 180 }));
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
