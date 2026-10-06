"""Reader for the bathymetry grid written by fetch_bathymetry.py."""

from __future__ import annotations

import array
import json
import sys

from _common import APP_DATA

HEADER = APP_DATA / "bathymetry_etopo2022_30s.json"


class Bathymetry:
    def __init__(self, header: dict, grid: array.array):
        self.header = header
        self.grid = grid
        self.rows = header["rows"]
        self.cols = header["cols"]
        self.north = header["northLat"]
        self.west = header["westLon"]
        self.step = header["stepDeg"]

    @classmethod
    def load(cls) -> "Bathymetry":
        header = json.loads(HEADER.read_text())
        grid = array.array("h")
        grid.frombytes((APP_DATA / header["file"]).read_bytes())
        if sys.byteorder != "little":
            grid.byteswap()
        return cls(header, grid)

    @classmethod
    def load_optional(cls) -> "Bathymetry | None":
        return cls.load() if HEADER.exists() else None

    def elevation(self, lon: float, lat: float) -> int | None:
        """Metres relative to mean sea level at the nearest cell; None outside the grid."""
        row = round((self.north - lat) / self.step)
        col = round((lon - self.west) / self.step)
        if 0 <= row < self.rows and 0 <= col < self.cols:
            return self.grid[row * self.cols + col]
        return None

    def depth(self, lon: float, lat: float) -> float | None:
        """Positive water depth in metres (0 on land); None outside the grid."""
        z = self.elevation(lon, lat)
        return None if z is None else max(0.0, -float(z))

    def is_water(self, lon: float, lat: float, min_depth_m: float = 0.0) -> bool:
        z = self.elevation(lon, lat)
        return z is not None and -z > min_depth_m
