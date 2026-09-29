import type { ImagePickerAsset } from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { supabase } from "@/lib/supabase";

const bucket = supabase.storage.from("Group-cover-images");
const maxBytes = 4 * 1024 * 1024;
async function uploadImage(path: string, uri: string): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Could not read the selected photo.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error("The compressed photo is too large. Choose a smaller image.");
  const { error } = await bucket.upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
}

export async function uploadGroupCover(groupId: string, asset: ImagePickerAsset): Promise<{
  coverPath: string;
  coverThumbnailPath: string;
}> {
  const original = await ImageManipulator.manipulate(asset.uri).renderAsync();
  if (!original.width || !original.height) throw new Error("Could not read the selected photo's dimensions.");

  const coverContext = ImageManipulator.manipulate(original);
  const scale = Math.min(1, 1200 / Math.max(original.width, original.height));
  coverContext.resize({
    width: Math.max(1, Math.round(original.width * scale)),
    height: Math.max(1, Math.round(original.height * scale)),
  });
  const cover = await (await coverContext.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });

  // Match the card's 96 x 112 image area so the thumbnail keeps enough pixels
  // after cropping. Use the same centered crop as resizeMode="cover".
  const cropWidth = Math.max(1, Math.floor(Math.min(original.width, original.height * 6 / 7)));
  const cropHeight = Math.max(1, Math.floor(Math.min(original.height, original.width * 7 / 6)));
  const thumbnailContext = ImageManipulator.manipulate(original);
  thumbnailContext.crop({
    originX: Math.floor((original.width - cropWidth) / 2),
    originY: Math.floor((original.height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  });
  const thumbnailWidth = Math.min(300, cropWidth);
  thumbnailContext.resize({
    width: thumbnailWidth,
    height: Math.max(1, Math.round(cropHeight * thumbnailWidth / cropWidth)),
  });
  const thumbnail = await (await thumbnailContext.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.75 });

  const random = crypto.getRandomValues(new Uint8Array(8));
  const suffix = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const prefix = `${groupId}/${Date.now()}-${suffix}`;
  const coverPath = `${prefix}-cover.jpg`;
  const coverThumbnailPath = `${prefix}-thumbnail.jpg`;
  try {
    await uploadImage(coverPath, cover.uri);
    await uploadImage(coverThumbnailPath, thumbnail.uri);
  } catch (error) {
    await removeGroupCoverFiles([coverPath, coverThumbnailPath]).catch(() => undefined);
    throw error;
  }
  return { coverPath, coverThumbnailPath };
}

export async function getGroupCoverUrl(path: string): Promise<string> {
  const { data, error } = await bucket.createSignedUrl(path, 60 * 15);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeGroupCoverFiles(paths: (string | null)[]): Promise<void> {
  const files = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!files.length) return;
  const { error } = await bucket.remove(files);
  if (error) throw error;
}
