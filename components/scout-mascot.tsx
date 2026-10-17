import { ScoutFriendlySvg } from "@/components/scout-friendly-svg";
import { ScoutReceiptSvg } from "@/components/scout-receipt-svg";

export type ScoutPose = "wave" | "receipt" | "celebrate";

export function ScoutMascot({ pose }: { pose: ScoutPose }) {
  if (pose === "receipt") {
    return <ScoutReceiptSvg />;
  }
  return <ScoutFriendlySvg pose={pose} size={160} />;
}
