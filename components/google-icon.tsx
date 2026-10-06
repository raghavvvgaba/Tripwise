import { Image, type ImageStyle, type StyleProp } from "react-native";

export function GoogleIcon({
  size = 20,
  style,
}: {
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={require("@/assets/google-icon.png")}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
    />
  );
}
