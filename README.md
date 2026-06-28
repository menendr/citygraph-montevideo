<h1 align="center">CityGraph: Montevideo</h1>

<p align="center">
  An interactive pathfinding visualizer over a real Montevideo street graph.
</p>

<p align="center">
  <a href="https://jrmenendez.dev/projects/citygraph-montevideo/"><strong>View project</strong></a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=111">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178c6?style=for-the-badge&logo=typescript&logoColor=fff">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8.1-646cff?style=for-the-badge&logo=vite&logoColor=fff">
  <img alt="OpenStreetMap" src="https://img.shields.io/badge/OpenStreetMap-data-7ebc6f?style=for-the-badge&logo=openstreetmap&logoColor=fff">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ed?style=for-the-badge&logo=docker&logoColor=fff">
</p>

Explore Montevideo as a living street graph, drag route endpoints across the city, compare pathfinding algorithms, and watch each search unfold through a polished WebGL map interface.

## Highlights

- Real Montevideo driving graph generated from OpenStreetMap data
- Draggable start and end points with animated search replay
- Dijkstra, bidirectional Dijkstra, A*, bidirectional A*, and ALT/Landmark A*
- WebGL-rendered dark map with neighborhood labels and grayscale map context
- Distance, path nodes, explored nodes, and efficiency metrics

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Zustand, Tailwind, Framer Motion |
| Visualization | deck.gl, WebGL |
| Graph Data | OpenStreetMap, OSMnx, NetworkX |
| Algorithms | Dijkstra, Bidirectional Dijkstra, A*, Bidirectional A*, ALT/Landmark A* |
| Deployment | Docker, nginx, Cloudflare Tunnel |

## Run Locally

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

## Docker

```bash
docker compose up --build
```

Open:

```text
http://localhost:5176
```

## Deployment

The app serves correctly from `/` by default. For a subpath deployment, set the Vite base path before building the Docker image:

```bash
VITE_BASE_PATH=/projects/citygraph-montevideo/
```

See `.env.example` for the local defaults.

## Verification

```bash
npm run check
```

## Graph Data

The repository includes a generated Montevideo graph so the project runs immediately after cloning.

To regenerate it from OpenStreetMap:

```bash
npm run graph:setup
npm run graph:build
```

OpenStreetMap data is © OpenStreetMap contributors and available under the Open Database License.
