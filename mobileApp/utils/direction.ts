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

export function degreeToDirection8(deg: number): string {
  const directions = [
    "N", "NE", "E", "SE",
    "S", "SW", "W", "NW",
  ];

  const index = Math.round(deg / 45) % 8;
  return directions[index];
}
