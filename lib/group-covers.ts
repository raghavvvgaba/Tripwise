import type { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "@/lib/supabase";

const bucket = supabase.storage.from("Group-cover-images");
const maxBytes = 4 * 1024 * 1024;
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadGroupCover(groupId: string, asset: ImagePickerAsset): Promise<string> {
  const contentType = asset.mimeType ?? "image/jpeg";
  const extension = extensions[contentType];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (asset.fileSize && asset.fileSize > maxBytes) throw new Error("Choose an image smaller than 4 MB.");

  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error("Could not read the selected photo.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error("Choose an image smaller than 4 MB.");

  const random = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const path = `${groupId}/${Date.now()}-${suffix}.${extension}`;
  const { error } = await bucket.upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function getGroupCoverUrl(path: string): Promise<string> {
  const { data, error } = await bucket.createSignedUrl(path, 60 * 15);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeGroupCoverFile(path: string): Promise<void> {
  const { error } = await bucket.remove([path]);
  if (error) throw error;
}
