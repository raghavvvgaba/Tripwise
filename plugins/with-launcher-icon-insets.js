const fs = require("node:fs/promises");
const path = require("node:path");
const { withFinalizedMod } = require("expo/config-plugins");

// Expo renders adaptive layers at 108dp, while Android displays the central 72dp.
// Our existing artwork is laid out for a full icon, so inset it into that area.
const inset = "16.6667%";

function insetLayer(name) {
  return `<inset android:drawable="@mipmap/${name}" android:insetLeft="${inset}" android:insetTop="${inset}" android:insetRight="${inset}" android:insetBottom="${inset}"/>`;
}

module.exports = function withLauncherIconInsets(config) {
  return withFinalizedMod(config, ["android", async (config) => {
    const directory = path.join(
      config.modRequest.platformProjectRoot,
      "app/src/main/res/mipmap-anydpi-v26",
    );
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground"/>
    <foreground>${insetLayer("ic_launcher_foreground")}</foreground>
    <monochrome>${insetLayer("ic_launcher_monochrome")}</monochrome>
</adaptive-icon>
`;
    await fs.mkdir(directory, { recursive: true });
    await Promise.all(["ic_launcher.xml", "ic_launcher_round.xml"].map(
      (name) => fs.writeFile(path.join(directory, name), xml),
    ));
    return config;
  }]);
};
