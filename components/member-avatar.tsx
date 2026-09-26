import { Text, View } from "react-native";

import type { Member } from "@/types/models";

type MemberAvatarProps = {
  member: Member;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

const textClasses = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
};

export function MemberAvatar({ member, size = "md" }: MemberAvatarProps) {
  return (
    <View
      className={`${sizeClasses[size]} items-center justify-center rounded-full`}
      style={{ backgroundColor: member.color }}
    >
      <Text className={`${textClasses[size]} font-bold text-[#17201B]`}>{member.initials}</Text>
    </View>
  );
}
