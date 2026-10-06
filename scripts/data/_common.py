"""Shared paths, region definition, download and geometry helpers.

Standard library only, so the data pipeline needs no extra installs.
"""

from __future__ import annotations

import gzip
import http.client
import json
import math
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Iterable, Sequence

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
APP_DATA = ROOT / "public" / "data" / "maritime"

# Palk Strait, Palk Bay and Gulf of Mannar with a margin around the app's
# map bounds (src/MaritimeMap.tsx OCEAN_REGION_BOUNDS: 8.1-10.3 N, 77.6-80.2 E).
REGION = {"south": 7.5, "north": 10.8, "west": 77.5, "east": 80.6}

USER_AGENT = "neythal-ai-data-pipeline/0.1 (offline dataset preparation)"

NM_M = 1852.0
EARTH_RADIUS_M = 6_371_008.8


def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


# ---------------------------------------------------------------- download


def build_url(base: str, params: dict | None = None) -> str:
    if not params:
        return base
    return f"{base}?{urllib.parse.urlencode(params, safe=',:()[]')}"


def download(
    url: str,
    dest: Path,
    *,
    data: bytes | None = None,
    force: bool = False,
    retries: int = 4,
    timeout: int = 300,
) -> Path:
    """Stream url to dest atomically. Skips the request when dest exists."""
    if dest.exists() and not force:
        log(f"  cached  {dest.relative_to(ROOT)}")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response, open(tmp, "wb") as out:
                total = int(response.headers.get("Content-Length") or 0)
                done = 0
                last = time.monotonic()
                while chunk := response.read(1 << 20):
                    out.write(chunk)
                    done += len(chunk)
                    if total and time.monotonic() - last > 10:
                        log(f"    {dest.name}: {done / total:5.1%} of {total / 1e6:.0f} MB")
                        last = time.monotonic()
            tmp.replace(dest)
            log(f"  fetched {dest.relative_to(ROOT)} ({dest.stat().st_size / 1e6:.2f} MB)")
            return dest
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead) as error:
            tmp.unlink(missing_ok=True)
            if attempt == retries or (isinstance(error, urllib.error.HTTPError) and error.code < 500):
                raise
            wait = 5 * attempt
            log(f"  retry {attempt}/{retries} in {wait}s: {error}")
            time.sleep(wait)
    raise AssertionError("unreachable")


def download_ranged(
    url: str, dest: Path, *, connections: int = 8, chunk_mb: int = 16, retries: int = 6
) -> Path:
    """Download a large file over parallel HTTP range requests.

    Some servers (NOAA's AIS archive) cap each connection at ~130 kB/s, so a
    single stream of a 300+ MB file takes hours. Finished chunks are recorded
    in a sidecar file so an interrupted run resumes where it stopped.
    """
    from concurrent.futures import ThreadPoolExecutor

    if dest.exists():
        log(f"  cached  {dest.relative_to(ROOT)}")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    head = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(head, timeout=60) as response:
        total = int(response.headers["Content-Length"])
        if response.headers.get("Accept-Ranges") != "bytes":
            return download(url, dest, timeout=3600)

    part = dest.with_suffix(dest.suffix + ".part")
    progress = dest.with_suffix(dest.suffix + ".chunks")
    if not part.exists() or part.stat().st_size != total:
        with open(part, "wb") as handle:
            handle.truncate(total)
        progress.write_text("")
    done_chunks = {int(x) for x in progress.read_text().split()} if progress.exists() else set()

    size = chunk_mb << 20
    chunks = [i for i in range((total + size - 1) // size) if i not in done_chunks]
    log(f"  {dest.name}: {total / 1e6:.0f} MB, {len(chunks)} chunks to fetch over {connections} connections")

    def fetch(index: int) -> int:
        start = index * size
        end = min(total, start + size) - 1
        request = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT, "Range": f"bytes={start}-{end}"}
        )
        for attempt in range(1, retries + 1):
            try:
                with urllib.request.urlopen(request, timeout=300) as response:
                    body = response.read()
                if len(body) != end - start + 1:
                    raise ConnectionError(f"short read {len(body)} for chunk {index}")
                with open(part, "r+b") as handle:
                    handle.seek(start)
                    handle.write(body)
                return index
            except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead) as error:
                if attempt == retries:
                    raise
                time.sleep(5 * attempt)
                log(f"    chunk {index} retry {attempt}: {error}")
        raise AssertionError("unreachable")

    finished = len(done_chunks)
    all_chunks = finished + len(chunks)
    with ThreadPoolExecutor(connections) as pool, open(progress, "a") as record:
        for index in pool.map(fetch, chunks):
            record.write(f"{index}\n")
            record.flush()
            finished += 1
            if finished % 4 == 0 or finished == all_chunks:
                log(f"    {dest.name}: {finished}/{all_chunks} chunks")
    part.replace(dest)
    progress.unlink(missing_ok=True)
    log(f"  fetched {dest.relative_to(ROOT)} ({total / 1e6:.0f} MB)")
    return dest


def read_json(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload, *, indent: int | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=indent, separators=None if indent else (",", ":"))
    path.write_text(text + "\n", encoding="utf-8")
    log(f"  wrote   {path.relative_to(ROOT)} ({path.stat().st_size / 1e3:.0f} kB)")
    return path


def copy_to(src: Path, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)
    return dest


# ---------------------------------------------------------------- geometry
# Coordinates are (lon, lat) everywhere, matching GeoJSON.


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def to_local_m(lon: float, lat: float, lon0: float, lat0: float) -> tuple[float, float]:
    """Equirectangular east/north metres from (lon0, lat0). Accurate to well
    under 0.5% within ~100 km, which is the scale of this region."""
    k = math.radians(1) * EARTH_RADIUS_M
    return (lon - lon0) * k * math.cos(math.radians(lat0)), (lat - lat0) * k


def from_local_m(east: float, north: float, lon0: float, lat0: float) -> tuple[float, float]:
    k = math.radians(1) * EARTH_RADIUS_M
    return lon0 + east / (k * math.cos(math.radians(lat0))), lat0 + north / k


def distance_to_segment_m(
    lon: float, lat: float, a: Sequence[float], b: Sequence[float]
) -> float:
    ax, ay = to_local_m(a[0], a[1], lon, lat)
    bx, by = to_local_m(b[0], b[1], lon, lat)
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    t = 0.0 if length2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length2))
    return math.hypot(ax + t * dx, ay + t * dy)


def distance_to_lines_m(lon: float, lat: float, lines: Iterable[Sequence[Sequence[float]]]) -> float:
    best = math.inf
    for line in lines:
        for a, b in zip(line, line[1:]):
            best = min(best, distance_to_segment_m(lon, lat, a, b))
    return best


def point_in_ring(lon: float, lat: float, ring: Sequence[Sequence[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def point_in_polygon(lon: float, lat: float, polygon: Sequence) -> bool:
    """polygon = [outer_ring, *holes]."""
    if not polygon or not point_in_ring(lon, lat, polygon[0]):
        return False
    return not any(point_in_ring(lon, lat, hole) for hole in polygon[1:])


def point_in_geometry(lon: float, lat: float, geometry: dict) -> bool:
    if geometry["type"] == "Polygon":
        return point_in_polygon(lon, lat, geometry["coordinates"])
    if geometry["type"] == "MultiPolygon":
        return any(point_in_polygon(lon, lat, p) for p in geometry["coordinates"])
    return False


def segments_cross(p1, p2, q1, q2) -> bool:
    """True when segment p1-p2 properly intersects q1-q2 (planar lon/lat test,
    fine for the short segments used here)."""

    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    d1, d2 = orient(q1, q2, p1), orient(q1, q2, p2)
    d3, d4 = orient(p1, p2, q1), orient(p1, p2, q2)
    return (d1 > 0) != (d2 > 0) and (d3 > 0) != (d4 > 0)


def path_crosses_lines(path: Sequence[Sequence[float]], lines) -> bool:
    for a, b in zip(path, path[1:]):
        for line in lines:
            for q1, q2 in zip(line, line[1:]):
                if segments_cross(a, b, q1, q2):
                    return True
    return False


def cpa_tcpa(
    own: tuple[float, float, float, float],
    other: tuple[float, float, float, float],
) -> tuple[float, float]:
    """Closest point of approach between two straight-line movers.

    Each mover is (east_m, north_m, sog_knots, cog_degrees). Returns
    (cpa_m, tcpa_s); tcpa is negative when the closest point is in the past.
    """
    kn = NM_M / 3600.0

    def velocity(sog, cog):
        r = math.radians(cog)
        return sog * kn * math.sin(r), sog * kn * math.cos(r)

    vx1, vy1 = velocity(own[2], own[3])
    vx2, vy2 = velocity(other[2], other[3])
    rx, ry = other[0] - own[0], other[1] - own[1]
    vx, vy = vx2 - vx1, vy2 - vy1
    v2 = vx * vx + vy * vy
    tcpa = 0.0 if v2 < 1e-9 else -(rx * vx + ry * vy) / v2
    return math.hypot(rx + vx * tcpa, ry + vy * tcpa), tcpa


def simplify(points, tolerance_m):
    """Douglas-Peucker in local metres; keeps first and last points."""
    if len(points) < 3:
        return points
    lon0, lat0 = points[0][0], points[0][1]
    xy = [to_local_m(p[0], p[1], lon0, lat0) for p in points]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay = xy[i]
        bx, by = xy[j]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy)
        best, index = -1.0, -1
        for k in range(i + 1, j):
            px, py = xy[k]
            d = abs(dy * (px - ax) - dx * (py - ay)) / norm if norm else math.hypot(px - ax, py - ay)
            if d > best:
                best, index = d, k
        if best > tolerance_m:
            keep[index] = True
            stack += [(i, index), (index, j)]
    return [p for p, k in zip(points, keep) if k]


def in_region(lon: float, lat: float, region: dict = REGION) -> bool:
    return region["west"] <= lon <= region["east"] and region["south"] <= lat <= region["north"]
