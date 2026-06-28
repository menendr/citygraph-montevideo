export type CityGraphViewportProfile = "desktop" | "mobile"

const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)"

export function getInitialViewportProfile(): CityGraphViewportProfile {
  if (typeof window === "undefined") return "desktop"
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches ? "mobile" : "desktop"
}
