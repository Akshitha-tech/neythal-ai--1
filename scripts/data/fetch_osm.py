"""Harbours, navigation hazards and protected areas from OpenStreetMap.

Source: OpenStreetMap via the Overpass API. Data (c) OpenStreetMap
contributors, Open Database Licence 1.0 (https://www.openstreetmap.org/copyright).
Coverage is community-mapped and uneven: several Palk Bay landing centres
(e.g. Pamban, Mandapam, Jegathapattinam) are not tagged as harbours yet.

Outputs (public/data/maritime/)
- osm_harbours.geojson         fishing harbours, ports, jetties (points)
- osm_hazards.geojson          reefs, shoals, wrecks, rocks, islands, lights, beacons,
                               platforms, submarine cables and pipelines
- osm_protected_areas.geojson  national parks, sanctuaries, reserves (polygons),
                               flagged when they extend over water
Raw Overpass responses: data/raw/osm/
"""

from __future__ import annotations

import re
from datetime import date

from _common import APP_DATA, RAW, REGION, download, log, read_json, simplify, write_json
from bathymetry import Bathymetry

OVERPASS = "https://overpass-api.de/api/interpreter"
BBOX = f"{REGION['south']},{REGION['west']},{REGION['north']},{REGION['east']}"
ATTRIBUTION = "(c) OpenStreetMap contributors, ODbL 1.0"

QUERIES = {
    "harbours": f"""
        nwr["harbour"]({BBOX});
        nwr["seamark:type"="harbour"]({BBOX});
        nwr["landuse"~"^(port|harbour)$"]({BBOX});
        nwr["industrial"="port"]({BBOX});
        nwr["man_made"="pier"]["name"]({BBOX});
        nwr["amenity"="ferry_terminal"]["name"~"[Jj]etty|[Hh]arbou?r|[Pp]ort"]({BBOX});
    """,
    "hazards": f"""
        nwr["seamark:type"]["seamark:type"!="harbour"]({BBOX});
        nwr["natural"~"^(reef|shoal|sandbar)$"]({BBOX});
        nwr["place"~"^(island|islet)$"]({BBOX});
        nwr["man_made"~"^(lighthouse|offshore_platform)$"]({BBOX});
        nwr["power"="cable"]["location"~"sub|under"]({BBOX});
        nwr["man_made"="pipeline"]["location"~"sub|under"]({BBOX});
    """,
    "protected_areas": f"""
        nwr["boundary"~"^(protected_area|national_park)$"]({BBOX});
        nwr["leisure"="nature_reserve"]({BBOX});
    """,
}

FISHING = re.compile(r"fish|மீன்", re.I)
SIMPLIFY_M = 10.0


def overpass(name: str) -> dict:
    query = f"[out:json][timeout:170];({QUERIES[name]});out geom;"
    from urllib.parse import urlencode

    path = RAW / "osm" / f"overpass_{name}.json"
    download(OVERPASS, path, data=urlencode({"data": query}).encode(), timeout=200)
    return read_json(path)


# ------------------------------------------------------------ geometry


def assemble_rings(ways: list[list[list[float]]]) -> list[list[list[float]]]:
    """Join open way fragments that share endpoints into closed rings."""
    pending = [w[:] for w in ways if len(w) >= 2]
    rings = []
    while pending:
        ring = pending.pop()
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, way in enumerate(pending):
                if way[0] == ring[-1]:
                    ring += way[1:]
                elif way[-1] == ring[-1]:
                    ring += way[-2::-1]
                elif way[-1] == ring[0]:
                    ring = way[:-1] + ring
                elif way[0] == ring[0]:
                    ring = way[:0:-1] + ring
                else:
                    continue
                pending.pop(i)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def coords(points) -> list[list[float]]:
    return [[round(p["lon"], 7), round(p["lat"], 7)] for p in points]


def element_geometry(element: dict, *, area: bool) -> dict | None:
    kind = element["type"]
    if kind == "node":
        return {"type": "Point", "coordinates": [element["lon"], element["lat"]]}
    if kind == "way":
        line = coords(element.get("geometry", []))
        if len(line) < 2:
            return None
        if area and line[0] == line[-1] and len(line) >= 4:
            return {"type": "Polygon", "coordinates": [line]}
        return {"type": "LineString", "coordinates": line}
    members = [m for m in element.get("members", []) if m.get("type") == "way" and m.get("geometry")]
    outers = assemble_rings([coords(m["geometry"]) for m in members if m.get("role") in ("outer", "")])
    inners = assemble_rings([coords(m["geometry"]) for m in members if m.get("role") == "inner"])
    if area and outers:
        from _common import point_in_ring

        polygons = [[outer] for outer in outers]
        for inner in inners:
            for polygon in polygons:
                if point_in_ring(inner[0][0], inner[0][1], polygon[0]):
                    polygon.append(inner)
                    break
        return {"type": "MultiPolygon", "coordinates": polygons}
    lines = [coords(m["geometry"]) for m in members]
    return {"type": "MultiLineString", "coordinates": lines} if lines else None


def representative_point(element: dict, geometry: dict) -> tuple[float, float]:
    if geometry["type"] == "Point":
        return tuple(geometry["coordinates"])
    bounds = element.get("bounds")
    if bounds:
        return ((bounds["minlon"] + bounds["maxlon"]) / 2, (bounds["minlat"] + bounds["maxlat"]) / 2)
    first = geometry["coordinates"]
    while isinstance(first[0], list):
        first = first[0]
    return tuple(first)


def all_vertices(geometry: dict):
    stack = [geometry["coordinates"]]
    while stack:
        item = stack.pop()
        if item and isinstance(item[0], (int, float)):
            yield item
        else:
            stack.extend(item)


def base_properties(element: dict) -> dict:
    tags = element.get("tags", {})
    return {
        "osmId": f"{element['type']}/{element['id']}",
        "name": tags.get("name:en") or tags.get("name"),
        "nameLocal": tags.get("name") if tags.get("name:en") else None,
        "nameTa": tags.get("name:ta"),
        "source": ATTRIBUTION,
    }


# ------------------------------------------------------------ categories


def harbour_category(tags: dict) -> str:
    name = tags.get("name", "") + " " + tags.get("name:en", "")
    category = tags.get("harbour:category") or tags.get("seamark:harbour:category") or ""
    if "fishing" in category or FISHING.search(name):
        return "fishing"
    if tags.get("industrial") == "port" or tags.get("landuse") in ("port", "harbour") or "cargo" in category:
        return "port"
    if tags.get("man_made") == "pier" or "jetty" in name.lower() or tags.get("amenity") == "ferry_terminal":
        return "jetty"
    return "harbour"


def hazard_category(tags: dict) -> str:
    # Island outlines also carry land-cover tags (natural=coastline/wood/...),
    # so the matched tag decides the category, in query order.
    if tags.get("seamark:type"):
        return tags["seamark:type"]
    if tags.get("natural") in ("reef", "shoal", "sandbar"):
        return tags["natural"]
    if tags.get("place") in ("island", "islet"):
        return tags["place"]
    if tags.get("man_made") in ("lighthouse", "offshore_platform", "pipeline"):
        return "submarine_pipeline" if tags["man_made"] == "pipeline" else tags["man_made"]
    if tags.get("power") == "cable":
        return "submarine_cable"
    return "other"


def simplified(geometry: dict) -> dict:
    """Douglas-Peucker every line/ring to SIMPLIFY_M; points are left as they are."""

    def walk(item):
        if item and isinstance(item[0][0], (int, float)):
            return [[round(x, 6), round(y, 6)] for x, y in simplify(item, SIMPLIFY_M)]
        return [walk(part) for part in item]

    if geometry["type"] == "Point":
        return geometry
    return {"type": geometry["type"], "coordinates": walk(geometry["coordinates"])}


def main() -> None:
    bathymetry = Bathymetry.load_optional()
    today = date.today().isoformat()
    meta = {"source": ATTRIBUTION, "region": REGION, "generated": today, "simplifiedToleranceM": SIMPLIFY_M, "notForNavigation": True}

    harbours = []
    for element in overpass("harbours")["elements"]:
        geometry = element_geometry(element, area=True)
        if not geometry:
            continue
        lon, lat = representative_point(element, geometry)
        tags = element.get("tags", {})
        props = base_properties(element) | {"category": harbour_category(tags)}
        harbours.append({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]}})
    harbours.sort(key=lambda f: (f["properties"]["category"], f["properties"]["name"] or "~"))

    hazards = []
    for element in overpass("hazards")["elements"]:
        tags = element.get("tags", {})
        category = hazard_category(tags)
        geometry = element_geometry(element, area=category in ("reef", "shoal", "sandbar", "island", "islet"))
        if not geometry:
            continue
        props = base_properties(element) | {
            "category": category,
            "seamark": {k.removeprefix("seamark:"): v for k, v in tags.items() if k.startswith("seamark:")} or None,
        }
        hazards.append({"type": "Feature", "properties": props, "geometry": simplified(geometry)})

    protected = []
    for element in overpass("protected_areas")["elements"]:
        geometry = element_geometry(element, area=True)
        if not geometry or geometry["type"] not in ("Polygon", "MultiPolygon"):
            continue
        tags = element.get("tags", {})
        over_water = None
        if bathymetry:
            over_water = any(bathymetry.is_water(lon, lat) for lon, lat in all_vertices(geometry))
        props = base_properties(element) | {
            "protectClass": tags.get("protect_class"),
            "designation": tags.get("protection_title") or tags.get("designation") or tags.get("boundary") or tags.get("leisure"),
            "extendsOverWater": over_water,
        }
        protected.append({"type": "Feature", "properties": props, "geometry": simplified(geometry)})

    write_json(APP_DATA / "osm_harbours.geojson", {"type": "FeatureCollection", "metadata": meta | {"title": "Harbours, ports and jetties"}, "features": harbours})
    write_json(APP_DATA / "osm_hazards.geojson", {"type": "FeatureCollection", "metadata": meta | {"title": "Navigation hazards and aids"}, "features": hazards})
    write_json(
        APP_DATA / "osm_protected_areas.geojson",
        {"type": "FeatureCollection", "metadata": meta | {"title": "Protected areas", "extendsOverWater": "true when any boundary vertex lies on an ETOPO water cell"}, "features": protected},
    )
    counts = {}
    for feature in hazards:
        counts[feature["properties"]["category"]] = counts.get(feature["properties"]["category"], 0) + 1
    log(f"  harbours {len(harbours)} ({sum(f['properties']['category'] == 'fishing' for f in harbours)} fishing), "
        f"hazards {len(hazards)} {counts}, protected areas {len(protected)} "
        f"({sum(bool(f['properties']['extendsOverWater']) for f in protected)} over water)")


if __name__ == "__main__":
    main()
