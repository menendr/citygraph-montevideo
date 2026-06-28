const MIN_SEARCH_DURATION_MS = 2_000
const MAX_SEARCH_DURATION_MS = 5_500
const MIN_PATH_REVEAL_DURATION_MS = 500
const MAX_PATH_REVEAL_DURATION_MS = 1_500
const SHORT_ROUTE_METERS = 1_200
const LONG_ROUTE_METERS = 16_000

export function getAnimationTiming(distanceMeters: number) {
  const routeMeters = Number.isFinite(distanceMeters) ? distanceMeters : LONG_ROUTE_METERS
  const distanceRatio = clamp(
    (routeMeters - SHORT_ROUTE_METERS) / (LONG_ROUTE_METERS - SHORT_ROUTE_METERS),
    0,
    1,
  )
  const easedRatio = distanceRatio * distanceRatio * (3 - 2 * distanceRatio)

  return {
    searchDurationMs: interpolate(
      MIN_SEARCH_DURATION_MS,
      MAX_SEARCH_DURATION_MS,
      easedRatio,
    ),
    pathRevealDurationMs: interpolate(
      MIN_PATH_REVEAL_DURATION_MS,
      MAX_PATH_REVEAL_DURATION_MS,
      easedRatio,
    ),
  }
}

export function formatSeconds(milliseconds: number) {
  return `${(milliseconds / 1000).toFixed(1)}s`
}

function interpolate(minimum: number, maximum: number, ratio: number) {
  return Math.round(minimum + (maximum - minimum) * ratio)
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value))
}
