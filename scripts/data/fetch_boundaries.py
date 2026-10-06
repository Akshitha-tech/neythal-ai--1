"""India-Sri Lanka International Maritime Boundary Line (IMBL) and maritime zones.

The IMBL is built from the coordinates written in the boundary treaties
(primary source), then cross-checked against the Marine Regions EEZ boundary
geometry. Territorial-sea (12 NM), contiguous-zone (24 NM), internal-waters
and straight-baseline geometry comes from Marine Regions, clipped to the
Neythal region.

Sources
- Treaties (UN DOALOS Delimitation Treaties Infobase copies hosted by Marine Regions):
  1974 Palk Strait to Adam's Bridge:  https://www.marineregions.org/documents/LKA-IND1974BW.PDF
  1976 Gulf of Mannar / Bay of Bengal: https://www.marineregions.org/documents/LKA-IND1976MB.PDF
  1976 extension 13m to point T:       https://www.marineregions.org/documents/LKA-IND1976TP.PDF
- Marine Regions Maritime Boundaries (Flanders Marine Institute, CC-BY 4.0):
  https://www.marineregions.org/  (WFS: https://geo.vliz.be/geoserver/MarineRegions/wfs)

Not for navigation: the treaties themselves say the positions at sea are fixed
by joint survey (Article 3 of the 1974 treaty, Article 4 of the 1976 treaty).

Outputs
- public/data/maritime/imbl.geojson            app-ready treaty line (great-circle densified)
- public/data/maritime/maritime_zones.geojson  12/24 NM, internal waters, baselines (clipped)
- data/raw/boundaries/                         treaty PDFs + raw WFS responses
"""

from __future__ import annotations

import math
from datetime import date

from _common import (
    APP_DATA,
    NM_M,
    RAW,
    REGION,
    build_url,
    distance_to_lines_m,
    download,
    log,
    read_json,
    simplify,
    write_json,
)

WFS = "https://geo.vliz.be/geoserver/MarineRegions/wfs"
TREATY_PDFS = {
    "LKA-IND1974BW": "https://www.marineregions.org/documents/LKA-IND1974BW.PDF",
    "LKA-IND1976MB": "https://www.marineregions.org/documents/LKA-IND1976MB.PDF",
    "LKA-IND1976TP": "https://www.marineregions.org/documents/LKA-IND1976TP.PDF",
}

# Positions exactly as written in the treaty texts (degrees, decimal minutes).
# The 1976 text prints position 4m longitude as "79° 18'.2 N"; it is East.
TREATY_SEGMENTS = [
    {
        "id": "palk-strait-1974",
        "name": "Palk Strait to Adam's Bridge (historic waters)",
        "treaty": "Agreement between Sri Lanka and India on the Boundary in Historic Waters "
        "between the two Countries and Related Matters",
        "signed": "1974-06-28",
        "document": "LKA-IND1974BW",
        "positions": [
            ("1", "10 05", "80 03"),
            ("2", "09 57", "79 35"),
            ("3", "09 40.15", "79 22.60"),
            ("4", "09 21.80", "79 30.70"),
            ("5", "09 13", "79 32"),
            ("6", "09 06", "79 32"),
        ],
    },
    {
        "id": "gulf-of-mannar-1976",
        "name": "Gulf of Mannar",
        "treaty": "Agreement between Sri Lanka and India on the Maritime Boundary between the "
        "two Countries in the Gulf of Mannar and the Bay of Bengal and Related Matters",
        "signed": "1976-03-23",
        "document": "LKA-IND1976MB",
        "positions": [
            ("1m", "09 06.0", "79 32.0"),
            ("2m", "09 00.0", "79 31.3"),
            ("3m", "08 53.8", "79 29.3"),
            ("4m", "08 40.0", "79 18.2"),
            ("5m", "08 37.2", "79 13.0"),
            ("6m", "08 31.2", "79 04.7"),
            ("7m", "08 22.2", "78 55.4"),
            ("8m", "08 12.2", "78 53.7"),
            ("9m", "07 35.3", "78 45.7"),
            ("10m", "07 21.0", "78 38.8"),
            ("11m", "06 30.8", "78 12.2"),
            ("12m", "05 53.9", "77 50.7"),
            ("13m", "05 00.0", "77 10.6"),
        ],
    },
    {
        "id": "gulf-of-mannar-extension-1976",
        "name": "Gulf of Mannar extension to the India-Sri Lanka-Maldives trijunction",
        "treaty": "Supplementary Agreement between Sri Lanka and India on the Extension of the "
        "Maritime Boundary in the Gulf of Mannar from Position 13 m to the Trijunction Point",
        "signed": "1976-11-22",
        "document": "LKA-IND1976TP",
        "positions": [
            ("13m", "05 00.0", "77 10.6"),
            ("T", "04 47.04", "77 01.40"),
        ],
    },
    {
        "id": "bay-of-bengal-1976",
        "name": "Bay of Bengal",
        "treaty": "Agreement between Sri Lanka and India on the Maritime Boundary between the "
        "two Countries in the Gulf of Mannar and the Bay of Bengal and Related Matters",
        "signed": "1976-03-23",
        "document": "LKA-IND1976MB",
        "positions": [
            ("1b", "10 05.0", "80 03.0"),
            ("1ba", "10 05.8", "80 05.0"),
            ("1bb", "10 08.4", "80 09.5"),
            ("2b", "10 33.0", "80 46.0"),
            ("3b", "10 41.7", "81 02.5"),
            ("4b", "11 02.7", "81 56.0"),
            ("5b", "11 16.0", "82 24.4"),
            ("6b", "11 26.6", "83 22.0"),
        ],
    },
]

MR_LAYERS = {
    "eez_boundaries": "Maritime boundary lines (treaty, 200 NM, straight baselines)",
    "eez_12nm": "Territorial sea (12 NM)",
    "eez_24nm": "Contiguous zone (24 NM)",
    "eez_internal_waters": "Internal waters",
}

DENSIFY_M = 500.0
SIMPLIFY_M = 25.0


def dm_to_degrees(value: str) -> float:
    degrees, minutes = value.split()
    return int(degrees) + float(minutes) / 60.0


def great_circle_points(a, b, step_m: float):
    """Points every step_m along the great circle from a to b (lon, lat)."""
    lon1, lat1, lon2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    p1 = (math.cos(lat1) * math.cos(lon1), math.cos(lat1) * math.sin(lon1), math.sin(lat1))
    p2 = (math.cos(lat2) * math.cos(lon2), math.cos(lat2) * math.sin(lon2), math.sin(lat2))
    omega = math.acos(max(-1.0, min(1.0, sum(x * y for x, y in zip(p1, p2)))))
    steps = max(1, math.ceil(omega * 6_371_008.8 / step_m))
    points = []
    for i in range(steps + 1):
        t = i / steps
        if omega < 1e-12:
            x, y, z = p1
        else:
            s1 = math.sin((1 - t) * omega) / math.sin(omega)
            s2 = math.sin(t * omega) / math.sin(omega)
            x, y, z = (s1 * u + s2 * v for u, v in zip(p1, p2))
        points.append(
            [round(math.degrees(math.atan2(y, x)), 6), round(math.degrees(math.atan2(z, math.hypot(x, y))), 6)]
        )
    return points


def treaty_features():
    features = []
    for segment in TREATY_SEGMENTS:
        vertices = [
            (label, dm_to_degrees(lon), dm_to_degrees(lat), lat, lon)
            for label, lat, lon in segment["positions"]
        ]
        line: list[list[float]] = []
        for a, b in zip(vertices, vertices[1:]):
            arc = great_circle_points((a[1], a[2]), (b[1], b[2]), DENSIFY_M)
            line.extend(arc if not line else arc[1:])
        features.append(
            {
                "type": "Feature",
                "id": segment["id"],
                "properties": {
                    "kind": "IMBL",
                    "name": segment["name"],
                    "treaty": segment["treaty"],
                    "signed": segment["signed"],
                    "sourceUrl": TREATY_PDFS[segment["document"]],
                    "construction": f"Great-circle arcs between treaty positions, densified every {DENSIFY_M:.0f} m",
                    "positions": [
                        {
                            "id": label,
                            "latitude": round(lat, 6),
                            "longitude": round(lon, 6),
                            "asWritten": f"{lat_dm} N, {lon_dm} E",
                        }
                        for label, lon, lat, lat_dm, lon_dm in vertices
                    ],
                },
                "geometry": {"type": "LineString", "coordinates": line},
            }
        )
    return features


# ------------------------------------------------------------ clipping


def clip_ring(ring, box):
    """Sutherland-Hodgman clip of a closed ring to an axis-aligned box."""
    west, south, east, north = box
    edges = [
        (lambda p: p[0] >= west, lambda a, b: _cut_x(a, b, west)),
        (lambda p: p[0] <= east, lambda a, b: _cut_x(a, b, east)),
        (lambda p: p[1] >= south, lambda a, b: _cut_y(a, b, south)),
        (lambda p: p[1] <= north, lambda a, b: _cut_y(a, b, north)),
    ]
    points = ring[:-1] if ring and ring[0] == ring[-1] else ring
    for inside, cut in edges:
        if not points:
            break
        output = []
        previous = points[-1]
        for current in points:
            if inside(current):
                if not inside(previous):
                    output.append(cut(previous, current))
                output.append(current)
            elif inside(previous):
                output.append(cut(previous, current))
            previous = current
        points = output
    if len(points) < 3:
        return None
    return points + [points[0]]


def _cut_x(a, b, x):
    t = (x - a[0]) / (b[0] - a[0])
    return [x, a[1] + t * (b[1] - a[1])]


def _cut_y(a, b, y):
    t = (y - a[1]) / (b[1] - a[1])
    return [a[0] + t * (b[0] - a[0]), y]


def clip_line(line, box):
    """Keep the parts of a polyline inside the box (Liang-Barsky per segment)."""
    west, south, east, north = box
    parts, current = [], []
    for a, b in zip(line, line[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        t0, t1 = 0.0, 1.0
        visible = True
        for p, q in ((-dx, a[0] - west), (dx, east - a[0]), (-dy, a[1] - south), (dy, north - a[1])):
            if p == 0:
                if q < 0:
                    visible = False
                    break
            else:
                r = q / p
                if p < 0:
                    t0 = max(t0, r)
                else:
                    t1 = min(t1, r)
                if t0 > t1:
                    visible = False
                    break
        if not visible:
            if current:
                parts.append(current)
                current = []
            continue
        start = [a[0] + t0 * dx, a[1] + t0 * dy]
        end = [a[0] + t1 * dx, a[1] + t1 * dy]
        if not current:
            current = [start]
        current.append(end)
        if t1 < 1.0:
            parts.append(current)
            current = []
    if current:
        parts.append(current)
    return [p for p in parts if len(p) >= 2]


def rounded(points):
    return [[round(p[0], 6), round(p[1], 6)] for p in points]


# ------------------------------------------------------------ marine regions


def fetch_marine_regions():
    raw = {}
    for layer in MR_LAYERS:
        # WFS 1.1.0 with EPSG:4326 uses latitude-first axis order in BBOX.
        url = build_url(
            WFS,
            {
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "typeName": f"MarineRegions:{layer}",
                "outputFormat": "application/json",
                "CQL_FILTER": f"BBOX(the_geom,{REGION['south']},{REGION['west']},{REGION['north']},{REGION['east']})",
            },
        )
        raw[layer] = read_json(download(url, RAW / "boundaries" / f"marineregions_{layer}.json"))
    return raw


def zone_features(raw):
    box = (REGION["west"], REGION["south"], REGION["east"], REGION["north"])
    features = []
    for layer, collection in raw.items():
        for feature in collection["features"]:
            props = feature["properties"]
            geometry = feature["geometry"]
            common = {
                "layer": layer,
                "description": MR_LAYERS[layer],
                "sovereign": props.get("sovereign1"),
                "otherSovereign": props.get("sovereign2"),
                "name": props.get("geoname") or props.get("line_name"),
                "lineType": props.get("line_type"),
                "mrgid": props.get("mrgid") or props.get("line_id"),
                "source": "Marine Regions Maritime Boundaries v12 (Flanders Marine Institute), CC-BY 4.0",
            }
            if geometry["type"] == "MultiPolygon":
                polygons = []
                for polygon in geometry["coordinates"]:
                    rings = [clip_ring(ring, box) for ring in polygon]
                    if rings[0] is None:
                        continue
                    polygons.append([rounded(simplify(r, SIMPLIFY_M)) for r in rings if r is not None])
                if polygons:
                    features.append(
                        {"type": "Feature", "properties": common, "geometry": {"type": "MultiPolygon", "coordinates": polygons}}
                    )
            elif geometry["type"] in ("MultiLineString", "LineString"):
                lines = geometry["coordinates"] if geometry["type"] == "MultiLineString" else [geometry["coordinates"]]
                parts = [rounded(simplify(p, SIMPLIFY_M)) for line in lines for p in clip_line(line, box)]
                if parts:
                    features.append(
                        {"type": "Feature", "properties": common, "geometry": {"type": "MultiLineString", "coordinates": parts}}
                    )
    return features


def cross_check(imbl, raw):
    """Distance from each treaty position to the Marine Regions treaty lines."""
    mr_lines = [
        line
        for f in raw["eez_boundaries"]["features"]
        if f["properties"].get("line_type") == "Treaty"
        and {f["properties"].get("sovereign1"), f["properties"].get("sovereign2")} == {"India", "Sri Lanka"}
        for line in f["geometry"]["coordinates"]
    ]
    report = []
    for feature in imbl:
        for position in feature["properties"]["positions"]:
            lon, lat = position["longitude"], position["latitude"]
            if not (REGION["west"] <= lon <= REGION["east"] and REGION["south"] <= lat <= REGION["north"]):
                continue
            report.append((feature["id"], position["id"], distance_to_lines_m(lon, lat, mr_lines)))
    return report


def main() -> None:
    for name, url in TREATY_PDFS.items():
        download(url, RAW / "boundaries" / f"{name}.pdf")
    raw = fetch_marine_regions()

    imbl = treaty_features()
    report = cross_check(imbl, raw)
    worst = max(d for *_, d in report)
    for segment, position, distance in report:
        log(f"    {segment:32s} position {position:>4s}: {distance:7.1f} m from Marine Regions line")
    log(f"  treaty vs Marine Regions: max {worst:.1f} m over {len(report)} positions in region")
    if worst > 250:
        raise SystemExit("IMBL cross-check failed: treaty positions disagree with Marine Regions by > 250 m")

    today = date.today().isoformat()
    write_json(
        APP_DATA / "imbl.geojson",
        {
            "type": "FeatureCollection",
            "metadata": {
                "title": "India-Sri Lanka International Maritime Boundary Line (IMBL)",
                "source": "Treaty texts 1974 and 1976 (UN DOALOS copies); cross-checked against Marine Regions v12",
                "crossCheckMaxDeviationM": round(worst, 1),
                "generated": today,
                "units": {"coordinates": "WGS84 lon/lat degrees"},
                "notForNavigation": True,
                "note": "Positions at sea are fixed by joint survey under the treaties; this line is for safety "
                "awareness and modelling, not navigation.",
            },
            "features": imbl,
        },
    )
    write_json(
        APP_DATA / "maritime_zones.geojson",
        {
            "type": "FeatureCollection",
            "metadata": {
                "title": "Maritime zones around Palk Strait and the Gulf of Mannar",
                "source": "Marine Regions Maritime Boundaries v12 (Flanders Marine Institute), CC-BY 4.0",
                "region": REGION,
                "clippedToRegion": True,
                "simplifiedToleranceM": SIMPLIFY_M,
                "generated": today,
                "notForNavigation": True,
            },
            "features": zone_features(raw),
        },
    )
    log(f"  IMBL total length in region: {imbl_length_nm(imbl):.1f} NM")


def imbl_length_nm(features):
    from _common import haversine_m, in_region

    total = 0.0
    for feature in features:
        line = feature["geometry"]["coordinates"]
        for a, b in zip(line, line[1:]):
            if in_region(*a) and in_region(*b):
                total += haversine_m(a[0], a[1], b[0], b[1])
    return total / NM_M


if __name__ == "__main__":
    main()
