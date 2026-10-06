"""Download NOAA MarineCadastre AIS daily files (US waters).

There is no open AIS archive for Indian waters, so these real tracks are used
only to learn how fishing vessels move (speed, turning, fishing vs transit).
Raw zips stay in data/raw/ais/noaa (gitignored); process_ais_noaa.py turns
them into the committed, region-independent training data.

Source: https://hub.marinecadastre.gov/pages/vesseltraffic
Licence: US Government work, public domain. NOAA notes the data are not
intended for navigation.

Usage: python3 scripts/data/fetch_ais_noaa.py [YYYY-MM-DD ...]
"""

from __future__ import annotations

import sys

from _common import RAW, download_ranged, log

BASE = "https://coast.noaa.gov/htdata/CMSP/AISDataHandler"

# One day per season so the motion statistics are not tied to one weather
# pattern. 2024 daily files currently return 404, so 2023 is used.
DEFAULT_DAYS = ["2023-01-10", "2023-04-15", "2023-07-15"]


def main(days: list[str]) -> None:
    for day in days:
        year, month, dom = day.split("-")
        name = f"AIS_{year}_{month}_{dom}.zip"
        download_ranged(f"{BASE}/{year}/{name}", RAW / "ais" / "noaa" / name)
    log("AIS download complete")


if __name__ == "__main__":
    main(sys.argv[1:] or DEFAULT_DAYS)
