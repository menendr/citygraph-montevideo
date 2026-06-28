from __future__ import annotations

import json
from pathlib import Path

import networkx as nx
import osmnx as ox


OUTPUT_PATH = Path(__file__).resolve().parents[1] / "public" / "data" / "montevideo-driving.json"


def main() -> None:
    graph = ox.graph_from_place(
        "Montevideo, Uruguay",
        network_type="drive",
        simplify=True,
        retain_all=False,
    )

    undirected = nx.Graph()
    for node_id, data in graph.nodes(data=True):
        undirected.add_node(str(node_id), lon=float(data["x"]), lat=float(data["y"]))

    for source, target, data in graph.edges(data=True):
        source_id = str(source)
        target_id = str(target)
        length = float(data.get("length", 0))
        if length <= 0 or source_id == target_id:
            continue

        previous = undirected.get_edge_data(source_id, target_id)
        if previous is None or length < previous["length"]:
            undirected.add_edge(source_id, target_id, length=length)

    largest_component = max(nx.connected_components(undirected), key=len)
    street_graph = undirected.subgraph(largest_component).copy()
    node_ids = sorted(street_graph.nodes)
    index_by_id = {node_id: index for index, node_id in enumerate(node_ids)}

    nodes = []
    for node_id in node_ids:
        data = street_graph.nodes[node_id]
        nodes.append([node_id, round(data["lon"], 7), round(data["lat"], 7)])

    edges = []
    for source, target, data in street_graph.edges(data=True):
        edges.append(
            [
                index_by_id[source],
                index_by_id[target],
                round(float(data["length"]), 2),
            ]
        )

    lons = [node[1] for node in nodes]
    lats = [node[2] for node in nodes]
    serialized = {
        "name": "CityGraph: Montevideo",
        "source": "OpenStreetMap driving network",
        "attribution": "© OpenStreetMap contributors. Data available under the Open Database License.",
        "bounds": {
            "minLon": min(lons),
            "minLat": min(lats),
            "maxLon": max(lons),
            "maxLat": max(lats),
        },
        "nodes": nodes,
        "edges": edges,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(serialized, separators=(",", ":")), encoding="utf-8")
    print(
        f"Wrote {OUTPUT_PATH} with {len(nodes):,} nodes and {len(edges):,} undirected edges."
    )


if __name__ == "__main__":
    main()
