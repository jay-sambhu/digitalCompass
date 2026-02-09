export type CompassType = "normal" | "zone16" | "zone32" | "chakra";

type DialTuning = {
  dialScale: number;
  dialOffset: { x: number; y: number;  };
};

const COMPASS_ASSETS = {
  normal: {
    dial: require("../assets/normalCompass/dial.png"),
    needle: require("../assets/normalCompass/needle.png"),
    icon: require("../assets/normalCompass/icon.png"),
    dialScale: 1.08,
    dialOffset: { x: 0, y: 0,  },
  },
  zone16: {
    dial: require("../assets/16ZoneVastuCompass/dial.png"),
    needle: require("../assets/16ZoneVastuCompass/needle.png"),
    icon: require("../assets/normalCompass/icon.png"),
    dialScale: 1.08,
    dialOffset: {  x: 5, y: 4 },
  },
  zone32: {
    dial: require("../assets/32ZoneVastuCompass/dial.png"),
    needle: require("../assets/normalCompass/needle.png"),
    icon: require("../assets/normalCompass/icon.png"),
    dialScale: 1.08,
    dialOffset: { x: 5, y: 4,  },
  },
  chakra: {
    dial: require("../assets/appliedVastuChakra/dial.png"),
    needle: require("../assets/normalCompass/needle.png"),
    icon: require("../assets/normalCompass/icon.png"),
    dialScale: 1.08,
    dialOffset: { x: 5, y: 4,  },
  },
} as const satisfies Record<CompassType, DialTuning & { dial: any; needle: any; icon: any }>;

export function getCompassAssets(type?: string) {
  switch (type) {
    case "zone16":
      return COMPASS_ASSETS.zone16;
    case "zone32":
      return COMPASS_ASSETS.zone32;
    case "chakra":
      return COMPASS_ASSETS.chakra;
    case "normal":
    default:
      return COMPASS_ASSETS.normal;
  }
}
