import { useCallback, useEffect, useId, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

const AnimatedG = Animated.createAnimatedComponent(G<{ matrix?: number[] }>);

// Vector redraw of assets/mascot/scout-receipt.svg. Keep the named groups for future animation.
export function ScoutReceiptSvg() {
  const id = useId().replace(/:/g, "");
  const [reduceMotion, setReduceMotion] = useState(true);
  const eyeOpen = useSharedValue(1);
  const receiptAngle = useSharedValue(0);
  const questionOffset = useSharedValue(0);

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
      cancelAnimation(receiptAngle);
      cancelAnimation(questionOffset);
      eyeOpen.set(1);
      receiptAngle.set(0);
      questionOffset.set(0);
    };
    if (reduceMotion) {
      stop();
      return stop;
    }

    const start = (tilt: boolean) => {
      eyeOpen.set(withRepeat(withSequence(
        withDelay(3400, withTiming(0.06, { duration: 90 })),
        withTiming(1, { duration: 140 }),
      ), -1, false));
      if (tilt) {
        questionOffset.set(withDelay(350, withSequence(
          withTiming(-6, { duration: 450, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.quad) }),
        )));
        receiptAngle.set(withDelay(350, withSequence(
          withTiming(-6, { duration: 450, easing: Easing.inOut(Easing.quad) }),
          withTiming(2, { duration: 300, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.quad) }),
        )));
      }
    };

    if (AppState.currentState === "active") start(true);
    const subscription = AppState.addEventListener("change", (state) => {
      stop();
      if (state === "active") start(false);
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, [eyeOpen, questionOffset, receiptAngle, reduceMotion]));

  const leftEyeProps = useAnimatedProps(() => {
    const scale = eyeOpen.get();
    return { matrix: [1, 0, 0, scale, 0, 158 * (1 - scale)] };
  });
  const rightEyeProps = useAnimatedProps(() => {
    const scale = eyeOpen.get();
    return { matrix: [1, 0, 0, scale, 0, 144 * (1 - scale)] };
  });
  const questionProps = useAnimatedProps(() => ({
    matrix: [1, 0, 0, 1, 0, questionOffset.get()],
  }));
  const receiptProps = useAnimatedProps(() => {
    // Rotate the receipt and its gripping paw together about the wrist.
    const radians = receiptAngle.get() * Math.PI / 180;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return { matrix: [c, s, -s, c, 280 - 280 * c + 194 * s, 194 - 280 * s - 194 * c] };
  });

  return (
    <Svg width="160" height="160" viewBox="0 0 320 320" accessible={false}>
        <Defs>
          <LinearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F6F2FF"/><Stop offset="0.55" stopColor="#ECE7F7"/><Stop offset="1" stopColor="#B7A5DD"/>
          </LinearGradient>
          <LinearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#CBBBEB"/><Stop offset="1" stopColor="#8E78B5"/>
          </LinearGradient>
          <LinearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFE8AF"/><Stop offset="1" stopColor="#F5D298"/>
          </LinearGradient>
          <LinearGradient id={`${id}-paw`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#51416F"/><Stop offset="1" stopColor="#2C254E"/>
          </LinearGradient>
        </Defs>
        <G stroke="#2C254E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <G id="feet">
            <Path d="M105 272 C91 281 79 295 87 303 C95 313 133 309 139 301 L143 274 Z" fill={`url(#${id}-paw)`} stroke="#DBD5ED" strokeWidth="7"/>
            <Path d="M105 272 C91 281 79 295 87 303 C95 313 133 309 139 301 L143 274 Z" fill={`url(#${id}-paw)`}/>
            <Path d="M188 273 L195 299 C202 308 241 305 242 295 C242 283 224 275 217 270 Z" fill={`url(#${id}-paw)`} stroke="#DBD5ED" strokeWidth="7"/>
            <Path d="M188 273 L195 299 C202 308 241 305 242 295 C242 283 224 275 217 270 Z" fill={`url(#${id}-paw)`}/>
          </G>
          <G id="handle">
            <Path d="M105 79 C96 26 147 15 166 48 L179 77 L157 81 L148 56 C139 39 122 48 125 75 Z" fill={`url(#${id}-side)`} stroke="#DBD5ED" strokeWidth="8"/>
            <Path d="M105 79 C96 26 147 15 166 48 L179 77 L157 81 L148 56 C139 39 122 48 125 75 Z" fill={`url(#${id}-side)`}/>
            <Path d="M110 61 C108 40 124 31 139 33" fill="none" stroke="#E6DDF8" strokeWidth="3"/>
          </G>
          <G id="receipt-arm">
            <Path d="M231 211 C265 207 288 181 287 163 C286 150 268 152 262 169 L231 185 Z" fill={`url(#${id}-paw)`} stroke="#DBD5ED" strokeWidth="8"/>
            <Path d="M231 211 C265 207 288 181 287 163 C286 150 268 152 262 169 L231 185 Z" fill={`url(#${id}-paw)`}/>
          </G>
          <G id="backpack">
            <Path d="M73 91 C89 71 171 63 204 72 C225 77 234 95 238 116 L252 239 C256 264 242 278 220 282 L105 291 C79 290 62 276 61 253 L52 132 C50 113 59 99 73 91 Z" fill={`url(#${id}-body)`} stroke="#DBD5ED" strokeWidth="9"/>
            <Path d="M73 91 C89 71 171 63 204 72 C225 77 234 95 238 116 L252 239 C256 264 242 278 220 282 L105 291 C79 290 62 276 61 253 L52 132 C50 113 59 99 73 91 Z" fill={`url(#${id}-body)`}/>
            <Path d="M79 91 C51 98 50 123 54 149 L64 252 C67 276 81 284 107 287 L94 122 C93 107 88 96 79 91 Z" fill={`url(#${id}-side)`} strokeWidth="3"/>
            <Path d="M91 121 L102 258 C104 274 116 281 133 281" fill="none" stroke="#F4EFFD" strokeWidth="7"/>
            <Path d="M230 221 C244 215 253 222 255 235 L258 251 C258 264 250 269 242 268" fill={`url(#${id}-side)`}/>
          </G>
          <G id="side-pocket">
            <Path d="M49 204 C57 194 75 193 89 201 L93 258 C91 274 62 278 51 263 C43 253 43 216 49 204 Z" fill={`url(#${id}-side)`}/>
            <Path d="M49 204 C57 194 75 193 89 201 C75 206 82 234 61 234 C47 234 42 220 49 204 Z" fill={`url(#${id}-body)`}/>
            <Circle cx="59" cy="216" r="5" fill="#FFF9EB" stroke="#E5BE7E" strokeWidth="3"/>
          </G>
          <G id="front-pocket">
            <Path d="M126 215 L214 204 C229 202 235 211 236 224 L239 250 C240 266 229 272 216 274 L138 283 C121 285 112 275 111 260 L109 238 C108 223 115 217 126 215 Z" fill={`url(#${id}-gold)`} stroke="#E5BE7E"/>
            <Path d="M123 224 L214 213 C224 212 228 216 229 225" fill="none" stroke="#FFF2CC" strokeWidth="4"/>
            <Path d="M124 238 L222 225" fill="none" stroke="#79501F" strokeWidth="4"/>
            <Path d="M132 239 L128 257 C127 265 141 265 142 258 L139 238 Z" fill="#F5D298" stroke="#79501F" strokeWidth="3"/>
            <Rect x="130" y="235" width="10" height="7" rx="2" fill="#FFE8AF" stroke="#79501F" strokeWidth="2"/>
          </G>
          <G id="face">
            <Path d="M84 91 C109 77 176 70 205 77 C226 83 232 108 236 137 L241 165 C245 187 229 200 209 204 L131 216 C107 219 95 204 91 182 L78 115 C75 102 77 95 84 91 Z" fill={`url(#${id}-body)`}/>
            <Path d="M96 91 C126 81 177 77 202 81" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="4"/>
            <G id="eyebrows" fill="none" strokeWidth="4">
              <Path d="M119 131 Q125 122 133 125"/><Path d="M184 113 Q192 107 199 115"/>
            </G>
            <G id="eyes" fill="#2C254E" stroke="none">
              <AnimatedG animatedProps={leftEyeProps}>
                <Ellipse cx="133" cy="158" rx="10" ry="16" transform="rotate(-8 133 158)"/>
                <Ellipse cx="136" cy="152" rx="3" ry="5" fill="#FFFFFF"/>
              </AnimatedG>
              <AnimatedG animatedProps={rightEyeProps}>
                <Ellipse cx="196" cy="144" rx="10" ry="16" transform="rotate(-8 196 144)"/>
                <Ellipse cx="199" cy="138" rx="3" ry="5" fill="#FFFFFF"/>
              </AnimatedG>
            </G>
            <G id="mouth"><Path d="M158 171 C164 183 180 178 183 165" fill="none" strokeWidth="5"/></G>
          </G>
          <G id="thinking-paw">
            <Path d="M111 209 C124 228 148 215 155 205 C148 196 153 188 161 191 C163 179 174 181 174 190 C186 179 194 187 188 195 C201 199 194 214 184 216 C171 239 142 247 122 235 C111 229 106 217 111 209 Z" fill={`url(#${id}-paw)`}/>
          </G>
          <AnimatedG animatedProps={receiptProps}>
          <G id="receipt">
            <Path d="M241 181 L264 120 L270 127 L278 123 L284 130 L292 127 L299 134 L307 131 L312 138 L285 200 L279 196 L272 199 L267 192 L260 195 L255 188 L248 191 Z" fill="#FFFFFF" stroke="#DBD5ED" strokeWidth="8"/>
            <Path d="M241 181 L264 120 L270 127 L278 123 L284 130 L292 127 L299 134 L307 131 L312 138 L285 200 L279 196 L272 199 L267 192 L260 195 L255 188 L248 191 Z" fill="#FFFFFF"/>
            <Path d="M269 143 L291 151 M265 154 L284 161 M261 165 L273 169" stroke="#B5A0DC" strokeWidth="4"/>
          </G>
          <G id="holding-paw">
            <Path d="M280 185 C270 182 270 175 277 172 C271 167 277 159 283 162 C283 152 295 155 299 163 C307 178 294 199 282 203 C275 201 275 192 282 190 Z" fill={`url(#${id}-paw)`}/>
            <Path d="M278 173 L285 175 M280 185 L287 186" fill="none" strokeWidth="2"/>
          </G>
          </AnimatedG>
          <G id="receipt-tag">
            <Path d="M73 120 C66 120 61 129 63 138" fill="none" stroke="#E5BE7E" strokeWidth="6"/>
            <Path d="M59 138 L75 145 L54 188 L49 183 L43 185 L39 179 L33 180 L28 174 L49 137 Q53 133 59 138 Z" fill="#FFFFFF"/>
            <Path d="M52 151 L63 157 M48 160 L58 165 M44 169 L52 173" stroke="#B5A0DC" strokeWidth="3"/>
            <Path d="M65 132 C79 134 83 121 77 118 C71 114 69 122 72 125" fill="none" stroke="#E5BE7E" strokeWidth="5"/>
          </G>
          <AnimatedG animatedProps={questionProps}>
          <G id="question-mark" fill="none" stroke="#DBD5ED" strokeWidth="11">
            <Path d="M261 59 C263 42 290 42 290 57 C291 69 274 68 274 79"/>
            <Path d="M274 91 L274 92"/>
          </G>
          <G fill="none" stroke="#9580BC" strokeWidth="7">
            <Path d="M261 59 C263 42 290 42 290 57 C291 69 274 68 274 79"/>
            <Path d="M274 91 L274 92"/>
          </G>
          </AnimatedG>
        </G>
    </Svg>
  );
}
