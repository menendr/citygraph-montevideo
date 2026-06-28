export type NeighborhoodLabel = {
  name: string
  lon: number
  lat: number
  minZoom: number
}

export const NEIGHBORHOOD_LABELS: NeighborhoodLabel[] = [
  { name: "Ciudad Vieja", lon: -56.2107, lat: -34.9069, minZoom: 1 },
  { name: "Centro", lon: -56.1914, lat: -34.9057, minZoom: 1 },
  { name: "Pocitos", lon: -56.1504, lat: -34.9082, minZoom: 1 },
  { name: "Carrasco", lon: -56.0562, lat: -34.8855, minZoom: 1 },
  { name: "Prado", lon: -56.2199, lat: -34.8619, minZoom: 1.1 },
  { name: "Cerro", lon: -56.2515, lat: -34.8793, minZoom: 1.1 },
  { name: "Punta Carretas", lon: -56.1601, lat: -34.9231, minZoom: 1.35 },
  { name: "Parque Rodo", lon: -56.1683, lat: -34.9122, minZoom: 1.35 },
  { name: "Tres Cruces", lon: -56.1661, lat: -34.8948, minZoom: 1.45 },
  { name: "Buceo", lon: -56.1294, lat: -34.9005, minZoom: 1.45 },
  { name: "Malvin", lon: -56.1068, lat: -34.8939, minZoom: 1.45 },
  { name: "La Union", lon: -56.1348, lat: -34.8782, minZoom: 1.55 },
  { name: "Aguada", lon: -56.1943, lat: -34.8917, minZoom: 1.65 },
  { name: "La Blanqueada", lon: -56.1545, lat: -34.8874, minZoom: 1.65 },
]
