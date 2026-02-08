export function degreeToDirection16(deg: number): string {
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
  ];

  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}
