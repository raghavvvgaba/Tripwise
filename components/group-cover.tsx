import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";

import { getGroupCoverUrl } from "@/lib/group-covers";
import type { SharedGroup } from "@/types/shared-group";

export function GroupCover({ group, compact = false }: { group: SharedGroup; compact?: boolean }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const path = compact ? group.coverThumbnailPath ?? group.coverPath : group.coverPath;

  useEffect(() => {
    let active = true;
    setImageUrl(null);
    let refresh: ReturnType<typeof setInterval> | undefined;
    if (path) {
      const load = () => {
        void getGroupCoverUrl(path)
          .then((url) => { if (active) setImageUrl(url); })
          .catch(() => { if (active) setImageUrl(null); });
      };
      load();
      refresh = setInterval(load, 12 * 60 * 1000);
    }
    return () => {
      active = false;
      if (refresh) clearInterval(refresh);
    };
  }, [path]);

  return (
    <View className={`${compact ? "h-28 w-24 shrink-0 rounded-2xl" : "h-48 w-full rounded-3xl"} items-center justify-center overflow-hidden bg-[#FB6B21]`}>
      <View className={`absolute -top-10 rotate-[28deg] bg-[#FFB292] ${compact ? "-left-12 h-24 w-40" : "-left-12 h-44 w-[120%]"}`} />
      <View className={`absolute -bottom-12 -left-12 -rotate-[28deg] bg-[#FF9B72] ${compact ? "h-20 w-40" : "h-36 w-[80%]"}`} />
      <Ionicons name="airplane-outline" size={compact ? 43 : 68} color="#FFFFFF" />
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          resizeMode="cover"
          accessibilityLabel={`${group.name} cover photo`}
          className="absolute inset-0 h-full w-full"
          onError={() => setImageUrl(null)}
        />
      ) : null}
    </View>
  );
}
