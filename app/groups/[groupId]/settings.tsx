import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { GroupCover } from "@/components/group-cover";
import { removeGroupCoverFiles, uploadGroupCover } from "@/lib/group-covers";
import { useSharedGroups, useGroupActions } from "@/hooks/use-shared-groups";
import { confirmAction, showError } from "@/utils/dialogs";

export default function GroupSettingsScreen() {
  const clay = useClayTheme();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { groups, isLoading } = useSharedGroups();
  const group = groups.find((item) => item.id === groupId);
  const { deleteGroup, setCover } = useGroupActions();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);

  async function chooseCover() {
    if (!group || isSavingCover) return;
    setIsSavingCover(true);
    let stage: string = "picker";
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled || !result.assets[0]) return;

      stage = "upload";
      const { coverPath, coverThumbnailPath } = await uploadGroupCover(group.id, result.assets[0]);
      try {
        stage = "group update";
        await setCover(group.id, coverPath, coverThumbnailPath);
      } catch (error) {
        await removeGroupCoverFiles([coverPath, coverThumbnailPath]).catch(() => undefined);
        throw error;
      }
      await removeGroupCoverFiles([group.coverPath, group.coverThumbnailPath]).catch(() => undefined);
      setIsEditingCover(false);
    } catch (error) {
      const title =
        stage === "upload"
          ? "Could not upload cover photo"
          : stage === "group update"
            ? "Could not save cover photo"
            : "Could not open photo library";
      showError(title, error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSavingCover(false);
    }
  }

  async function removeCover() {
    if (!group?.coverPath || isSavingCover) return;
    setIsSavingCover(true);
    try {
      const oldPaths = [group.coverPath, group.coverThumbnailPath];
      await setCover(group.id, null, null);
      await removeGroupCoverFiles(oldPaths).catch(() => undefined);
      setIsEditingCover(false);
    } catch (error) {
      showError("Could not remove cover photo", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setIsSavingCover(false);
    }
  }

  async function removeGroup() {
    if (!group || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteGroup(group.id);
      router.dismissTo("/");
    } catch (cause) {
      showError("Could not delete group", cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center gap-3 px-5 pb-5 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={{ backgroundColor: clay.headerBtn, borderColor: clay.cardBorder }}
          className="h-11 w-11 items-center justify-center rounded-2xl border active:opacity-75"
        >
          <Ionicons name="chevron-back" size={20} color={clay.textPrimary} />
        </Pressable>
        <Text style={{ color: clay.textPrimary }} className="flex-1 text-lg font-semibold">Group settings</Text>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="w-full max-w-2xl self-center px-5 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {isLoading && !group ? (
          <ActivityIndicator color={clay.heroAccent} className="py-16" />
        ) : !group || group.deletedAt ? (
          <View
            style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
            className="items-center gap-3 rounded-3xl border px-6 py-10 shadow-sm"
          >
            <Ionicons
              name={group?.deletedAt ? "trash-outline" : "search-outline"}
              size={28}
              color={group?.deletedAt ? clay.errorText : clay.textMuted}
            />
            <Text style={{ color: clay.textPrimary }} className="text-center text-lg font-semibold">
              {group?.deletedAt ? "Group deleted" : "Group not found"}
            </Text>
            <Text style={{ color: clay.textMuted }} className="text-center text-sm leading-5">
              {group?.deletedAt
                ? "Restore it from Activity or Deleted groups in Account settings."
                : "Return to your groups and try again."}
            </Text>
          </View>
        ) : (
          <>
            <View className="relative overflow-hidden rounded-3xl">
              <GroupCover group={group} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isEditingCover ? "Close cover photo options" : "Edit cover photo"}
                accessibilityState={{ expanded: isEditingCover, disabled: isSavingCover || isDeleting }}
                disabled={isSavingCover || isDeleting}
                onPress={() => setIsEditingCover((value) => !value)}
                style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                className="absolute bottom-3 right-3 min-h-11 flex-row items-center justify-center gap-2 rounded-full border px-4 shadow-sm active:opacity-75 disabled:opacity-75"
              >
                {isSavingCover ? (
                  <>
                    <ActivityIndicator color={clay.textPrimary} size="small" />
                    <Text style={{ color: clay.textPrimary }} className="text-sm font-semibold">Saving…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name={isEditingCover ? "close" : "pencil-outline"} size={16} color={clay.textPrimary} />
                    <Text style={{ color: clay.textPrimary }} className="text-sm font-semibold">
                      {isEditingCover ? "Done" : "Edit"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>

            {isEditingCover ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                <Pressable
                  accessibilityRole="button"
                  disabled={isSavingCover || isDeleting}
                  onPress={() => void chooseCover()}
                  style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                  className="min-h-11 flex-row items-center justify-center gap-2 rounded-2xl border px-4 py-3 active:opacity-75 disabled:opacity-50"
                >
                  <Ionicons name="image-outline" size={18} color={clay.textPrimary} />
                  <Text style={{ color: clay.textPrimary }} className="text-sm font-medium">
                    {group.coverPath ? "Change photo" : "Add photo"}
                  </Text>
                </Pressable>
                {group.coverPath ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove cover photo"
                    disabled={isSavingCover || isDeleting}
                    onPress={() => void removeCover()}
                    style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
                    className="min-h-11 flex-row items-center justify-center gap-2 rounded-2xl border px-4 py-3 active:opacity-75 disabled:opacity-50"
                  >
                    <Ionicons name="trash-outline" size={18} color={clay.textMuted} />
                    <Text style={{ color: clay.textMuted }} className="text-sm font-medium">Remove photo</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View className="gap-1 pt-5">
              <Text style={{ color: clay.textPrimary }} className="text-2xl font-semibold">{group.name}</Text>
              <Text style={{ color: clay.textMuted }} className="text-sm">{group.currency} · Shared group</Text>
            </View>

            <View style={{ backgroundColor: clay.cardBorder }} className="mb-3 mt-8 h-px w-full" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete group"
              disabled={isDeleting || isSavingCover}
              onPress={() =>
                confirmAction(
                  "Delete this group for everyone?",
                  "The group and its expenses will be hidden for all members. Any member can restore them later from Activity or Account settings.",
                  "Delete group",
                  () => void removeGroup()
                )
              }
              className="min-h-12 flex-row items-center gap-3 py-3 active:opacity-75 disabled:opacity-50"
            >
              {isDeleting ? (
                <ActivityIndicator color={clay.errorText} size="small" />
              ) : (
                <Ionicons name="trash-outline" size={20} color={clay.errorText} />
              )}
              <Text style={{ color: clay.errorText }} className="text-base font-medium">
                {isDeleting ? "Deleting…" : "Delete group"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
