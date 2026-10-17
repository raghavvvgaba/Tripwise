import { useCallback, useEffect, useId, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G<{ matrix?: number[] }>);

// These poses share Scout's face and palette; only the greeting paw moves.
export function ScoutFriendlySvg({ pose, size }: {
  pose: "peek" | "wave" | "celebrate";
  size?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [reduceMotion, setReduceMotion] = useState(true);
  const eyeOpen = useSharedValue(1);
  const waveAngle = useSharedValue(0);

  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      receivedChange = true;
      setReduceMotion(enabled);
    });
    // Read the current setting on every mount; it may have changed since app startup.
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !receivedChange) setReduceMotion(enabled);
    }).catch(() => {
      // Keep motion disabled if the accessibility setting cannot be read.
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useFocusEffect(useCallback(() => {
    const stop = () => {
      cancelAnimation(eyeOpen);
      cancelAnimation(waveAngle);
      eyeOpen.set(1);
      waveAngle.set(0);
    };
    const start = (greet: boolean) => {
      eyeOpen.set(withRepeat(withSequence(
        withDelay(3600, withTiming(0.06, { duration: 90 })),
        withTiming(1, { duration: 140 }),
      ), -1, false));
      if (greet && pose === "wave") {
        const timing = { duration: 220, easing: Easing.inOut(Easing.quad) };
        waveAngle.set(withDelay(400, withSequence(
          withTiming(-12, timing), withTiming(10, timing),
          withTiming(-10, timing), withTiming(8, timing),
          withTiming(0, { ...timing, duration: 300 }),
        )));
      }
    };
    if (reduceMotion) {
      stop();
      return stop;
    }
    if (AppState.currentState === "active") start(true);
    const subscription = AppState.addEventListener("change", (state) => {
      stop();
      if (state === "active") start(false);
    });
    return () => { subscription.remove(); stop(); };
  }, [eyeOpen, pose, reduceMotion, waveAngle]));

  const eyesProps = useAnimatedProps(() => {
    const scale = eyeOpen.get();
    return { matrix: [1, 0, 0, scale, 0, 144 * (1 - scale)] };
  });
  const waveProps = useAnimatedProps(() => {
    const angle = waveAngle.get() * Math.PI / 180;
    const c = Math.cos(angle), s = Math.sin(angle);
    return { matrix: [c, s, -s, c, 277 - 277 * c + 150 * s, 150 - 277 * s - 150 * c] };
  });
  const peek = pose === "peek";
  return (
    <Svg width={size ?? (peek ? 112 : 96)} height={size ?? (peek ? 64 : 104)} viewBox={peek ? "0 0 320 230" : "0 0 350 340"} accessible={false}>
      <Defs>
        <LinearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FCFAFF"/><Stop offset="0.55" stopColor="#ECE7F7"/><Stop offset="1" stopColor="#B7A5DD"/>
        </LinearGradient>
        <LinearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#CBBBEB"/><Stop offset="1" stopColor="#8E78B5"/>
        </LinearGradient>
        <LinearGradient id={`${id}-paw`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#51416F"/><Stop offset="1" stopColor="#2C254E"/>
        </LinearGradient>
      </Defs>
      <G stroke="#2C254E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M113 66 C110 9 192 5 201 66 L181 69 C174 30 134 33 136 68 Z" fill={`url(#${id}-side)`} stroke="#DBD5ED" strokeWidth="9"/>
        <Path d="M113 66 C110 9 192 5 201 66 L181 69 C174 30 134 33 136 68 Z" fill={`url(#${id}-side)`}/>
        {!peek && <>
          <Path d="M94 280 C78 294 73 312 87 316 L132 315 L138 281 M189 280 L197 313 L239 312 C250 305 232 286 220 278" fill={`url(#${id}-paw)`} stroke="#DBD5ED" strokeWidth="8"/>
          <Path d="M94 280 C78 294 73 312 87 316 L132 315 L138 281 M189 280 L197 313 L239 312 C250 305 232 286 220 278" fill={`url(#${id}-paw)`}/>
          {pose === "celebrate" ? (
            <G fill={`url(#${id}-paw)`}>
              <Path d="M64 190 Q32 181 23 148 L16 120 C5 108 12 100 20 108 C13 90 24 87 30 100 C29 80 42 81 43 100 C52 85 62 94 55 111 C73 102 78 113 65 125 Q58 137 59 153 L77 171 Z" stroke="#DBD5ED" strokeWidth="9"/>
              <Path d="M64 190 Q32 181 23 148 L16 120 C5 108 12 100 20 108 C13 90 24 87 30 100 C29 80 42 81 43 100 C52 85 62 94 55 111 C73 102 78 113 65 125 Q58 137 59 153 L77 171 Z"/>
            </G>
          ) : (
            <Path d="M53 202 C24 203 20 249 43 254 C61 254 67 225 70 216" fill={`url(#${id}-paw)`} stroke="#DBD5ED" strokeWidth="8"/>
          )}
          <Path d="M74 174 L61 258 C60 280 78 292 104 293 L221 283 C243 281 253 268 249 244 L235 169 Z" fill={`url(#${id}-side)`} stroke="#DBD5ED" strokeWidth="9"/>
          <Path d="M74 174 L61 258 C60 280 78 292 104 293 L221 283 C243 281 253 268 249 244 L235 169 Z" fill={`url(#${id}-body)`}/>
          <Path d="M112 220 L217 209 Q232 208 233 224 L238 259 Q238 273 219 276 L126 284 Q111 285 109 270 L105 238 Q103 224 112 220 Z" fill="#F5D298" stroke="#E5BE7E"/>
          <Path d="M119 238 L221 227 M130 238 L127 256 Q135 265 141 256 L138 237" fill="none" stroke="#79501F" strokeWidth="3"/>
          <AnimatedG animatedProps={waveProps}>
            <G transform="translate(22 -25)">
            <Path d="M233 197 Q265 192 276 159 L286 132 C299 123 294 115 286 117 C295 100 283 96 276 108 C280 86 266 86 263 104 C257 88 247 94 251 112 C234 101 229 111 241 124 Q248 137 249 151 L233 168 Z" fill={`url(#${id}-paw)`} stroke="#DBD5ED" strokeWidth="9"/>
            <Path d="M233 197 Q265 192 276 159 L286 132 C299 123 294 115 286 117 C295 100 283 96 276 108 C280 86 266 86 263 104 C257 88 247 94 251 112 C234 101 229 111 241 124 Q248 137 249 151 L233 168 Z" fill={`url(#${id}-paw)`}/>
            </G>
          </AnimatedG>
        </>}
        <Path d="M64 78 C91 56 216 51 245 77 C267 96 276 141 279 185 Q281 210 253 214 L80 219 Q46 220 43 192 L37 120 Q36 93 64 78 Z" fill={`url(#${id}-side)`} stroke="#DBD5ED" strokeWidth="9"/>
        <Path d="M64 78 C91 56 216 51 245 77 C267 96 276 141 279 185 Q281 210 253 214 L80 219 Q46 220 43 192 L37 120 Q36 93 64 78 Z" fill={`url(#${id}-side)`}/>
        <Path d="M83 70 Q69 76 76 105 L84 179 Q87 210 119 214 L251 208 Q275 206 271 180 L258 114 Q252 78 230 70 Q156 53 83 70 Z" fill={`url(#${id}-body)`}/>
        <Path d="M95 74 Q155 61 227 74" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeOpacity="0.8"/>
        <Path d="M111 116 Q119 105 130 110 M210 109 Q220 103 228 115" fill="none" strokeWidth="5"/>
        <AnimatedG animatedProps={eyesProps} fill="#2C254E" stroke="none">
          <Ellipse cx="124" cy="144" rx="11" ry="18"/><Ellipse cx="216" cy="144" rx="11" ry="18"/>
          <Ellipse cx="127" cy="137" rx="3.5" ry="5" fill="#FFFFFF"/><Ellipse cx="219" cy="137" rx="3.5" ry="5" fill="#FFFFFF"/>
        </AnimatedG>
        {pose === "celebrate" ? (
          <Path d="M153 169 Q170 177 189 166 Q182 196 166 189 Q157 185 153 169 Z" fill="#2C254E" strokeWidth="3"/>
        ) : (
          <Path d="M155 169 Q169 191 186 167" fill="none" strokeWidth="6"/>
        )}
        {pose === "celebrate" && (
          <G fill="#F5D298" stroke="#E5BE7E" strokeWidth="2">
            <Path d="M45 28 L49 38 L60 42 L49 46 L45 57 L41 46 L30 42 L41 38 Z"/>
            <Path d="M287 16 L291 26 L302 30 L291 34 L287 45 L283 34 L272 30 L283 26 Z"/>
            <Path d="M322 205 L325 212 L333 215 L325 218 L322 226 L319 218 L311 215 L319 212 Z"/>
          </G>
        )}
        <Path d="M57 110 Q48 115 49 129" fill="none" stroke="#E5BE7E" strokeWidth="6"/>
        <Path d="M43 128 L61 137 L38 179 L31 176 L26 177 L20 171 L14 172 L9 165 L33 128 Q37 124 43 128 Z" fill="#FFFFFF"/>
        <Path d="M34 142 L47 149 M29 152 L41 158 M24 161 L34 166" stroke="#B5A0DC" strokeWidth="3"/>
        {peek && <G fill={`url(#${id}-paw)`}>
          <Path d="M57 197 C34 197 26 216 35 223 Q47 231 56 219 Q61 235 76 223 Q87 235 98 222 C112 204 83 192 57 197 Z" stroke="#DBD5ED" strokeWidth="8"/>
          <Path d="M57 197 C34 197 26 216 35 223 Q47 231 56 219 Q61 235 76 223 Q87 235 98 222 C112 204 83 192 57 197 Z"/>
          <Path d="M251 197 C227 197 218 216 228 223 Q240 231 249 219 Q254 235 269 223 Q280 235 291 222 C305 204 277 192 251 197 Z" stroke="#DBD5ED" strokeWidth="8"/>
          <Path d="M251 197 C227 197 218 216 228 223 Q240 231 249 219 Q254 235 269 223 Q280 235 291 222 C305 204 277 192 251 197 Z"/>
        </G>}
      </G>
    </Svg>
  );
}
