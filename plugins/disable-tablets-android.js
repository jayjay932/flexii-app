// Désactive explicitement les grandes tailles d’écran (tablettes) dans AndroidManifest.
// Fonctionne en build EAS (config plugin Expo).
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withDisableTabletsAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Assure l’existence de supports-screens sur le manifeste
    if (!manifest.manifest["supports-screens"]) {
      manifest.manifest["supports-screens"] = [
        {
          $: {
            "android:smallScreens": "true",
            "android:normalScreens": "true",
            "android:largeScreens": "false",
            "android:xlargeScreens": "false"
          }
        }
      ];
    } else {
      // Édite l’entrée existante
      const node = manifest.manifest["supports-screens"][0];
      node.$["android:smallScreens"] = "true";
      node.$["android:normalScreens"] = "true";
      node.$["android:largeScreens"] = "false";
      node.$["android:xlargeScreens"] = "false";
    }

    // Optionnel : exclut les devices sans téléphonie (souvent tablettes Wi-Fi)
    // Décommente si tu veux être encore plus strict :
    // if (!manifest.manifest["uses-feature"]) manifest.manifest["uses-feature"] = [];
    // manifest.manifest["uses-feature"].push({
    //   $: { "android:name": "android.hardware.telephony", "android:required": "true" }
    // });

    return config;
  });
};
