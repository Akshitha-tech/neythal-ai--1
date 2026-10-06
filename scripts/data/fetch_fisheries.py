"""Official and reconstructed fisheries catch statistics for India and Sri Lanka.

Sources
- FAO Global Capture Production 1950-2023 (release 2025.1.0), FAO Fisheries and
  Aquaculture Division. Country-reported official statistics. CC BY 4.0.
  https://www.fao.org/fishery/en/collection/capture
  Filtered to India (UN 356) and Sri Lanka (UN 144) in FAO Major Fishing Area 57
  (Indian Ocean, Eastern), which contains the Tamil Nadu coast, Palk Bay and the
  Gulf of Mannar.
- Sea Around Us (University of British Columbia) catch reconstruction by EEZ,
  1950-2019: catch by taxon, gear and reporting status for "India (mainland)"
  (region 356) and "Sri Lanka" (region 144). CC BY-NC 4.0 (non-commercial).
  Cite: Pauly D., Zeller D., Palomares M.L.D. (Editors), Sea Around Us Concepts,
  Design and Data (www.seaaroundus.org).

Neither source resolves catch below country/EEZ level, so these describe which
species and gears matter regionally, not where fish are on a given day.

Outputs
- data/processed/fisheries/fao_capture_india_srilanka_area57.csv
- data/processed/fisheries/seaaroundus_eez_catch.csv
- public/data/maritime/fisheries_summary.json   top species and gear shares, recent years
- data/raw/fisheries/                            FAO zip and Sea Around Us API responses
"""

from __future__ import annotations

import csv
import io
import statistics
import zipfile
from collections import defaultdict
from datetime import date

from _common import APP_DATA, PROCESSED, RAW, download, log, read_json, write_json

FAO_ZIP = "https://www.fao.org/fishery/static/Data/Capture_2025.1.0.zip"
SAU_API = "https://api.seaaroundus.org/api/v1/eez/tonnage/{dimension}/?region_id={region}&format=json"

COUNTRIES = {"356": "India", "144": "Sri Lanka"}
FAO_AREA = "57"
FIRST_YEAR = 2000
SAU_REGIONS = {356: "India (mainland)", 144: "Sri Lanka"}
SAU_DIMENSIONS = ("taxon", "gear", "reporting-status")
RECENT_YEARS = 5
TOP_N = 15


def fao() -> list[dict]:
    path = download(FAO_ZIP, RAW / "fisheries" / "FAO_Capture_2025.1.0.zip")
    with zipfile.ZipFile(path) as archive:
        with archive.open("CL_FI_SPECIES_GROUPS.csv") as handle:
            species = {
                row["3A_Code"]: row
                for row in csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig"))
            }
        rows = []
        with archive.open("Capture_Quantity.csv") as handle:
            for row in csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8-sig")):
                if (
                    row["COUNTRY.UN_CODE"] in COUNTRIES
                    and row["AREA.CODE"] == FAO_AREA
                    and row["MEASURE"] == "Q_tlw"
                    and int(row["PERIOD"]) >= FIRST_YEAR
                ):
                    info = species.get(row["SPECIES.ALPHA_3_CODE"], {})
                    rows.append(
                        {
                            "country": COUNTRIES[row["COUNTRY.UN_CODE"]],
                            "year": int(row["PERIOD"]),
                            "species_code": row["SPECIES.ALPHA_3_CODE"],
                            "species": info.get("Name_En", ""),
                            "scientific_name": info.get("Scientific_Name", ""),
                            "isscaap_group": info.get("ISSCAAP_Group_En", ""),
                            "major_group": info.get("Major_Group", ""),
                            "tonnes_live_weight": float(row["VALUE"]),
                            "status": row["STATUS"],
                        }
                    )
    return rows


def sea_around_us() -> list[dict]:
    rows = []
    for region, name in SAU_REGIONS.items():
        for dimension in SAU_DIMENSIONS:
            path = download(
                SAU_API.format(dimension=dimension, region=region),
                RAW / "fisheries" / f"seaaroundus_{region}_{dimension}.json",
            )
            for series in read_json(path)["data"]:
                for year, tonnes in series["values"]:
                    if tonnes is None:
                        continue
                    rows.append(
                        {"eez": name, "dimension": dimension, "key": series["key"], "year": int(year), "tonnes": round(tonnes, 1)}
                    )
    return rows


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    log(f"  wrote   {path.name} ({len(rows):,} rows)")


def main() -> None:
    fao_rows = fao()
    sau_rows = sea_around_us()
    write_csv(PROCESSED / "fisheries" / "fao_capture_india_srilanka_area57.csv", fao_rows)
    write_csv(PROCESSED / "fisheries" / "seaaroundus_eez_catch.csv", sau_rows)

    summary = {"fao": {}, "seaAroundUs": {}}
    for country in COUNTRIES.values():
        last = max(r["year"] for r in fao_rows if r["country"] == country)
        years = range(last - RECENT_YEARS + 1, last + 1)
        totals = defaultdict(float)
        names = {}
        for r in fao_rows:
            if r["country"] == country and r["year"] in years:
                totals[r["species_code"]] += r["tonnes_live_weight"] / RECENT_YEARS
                names[r["species_code"]] = (r["species"], r["scientific_name"], r["isscaap_group"])
        grand = sum(totals.values())
        summary["fao"][country] = {
            "years": [years[0], years[-1]],
            "meanAnnualTonnes": round(grand),
            "topSpecies": [
                {
                    "code": code, "name": names[code][0], "scientificName": names[code][1], "group": names[code][2],
                    "meanAnnualTonnes": round(tonnes), "share": round(tonnes / grand, 4),
                }
                for code, tonnes in sorted(totals.items(), key=lambda kv: -kv[1])[:TOP_N]
            ],
        }
    for eez in SAU_REGIONS.values():
        last = max(r["year"] for r in sau_rows if r["eez"] == eez)
        years = range(last - RECENT_YEARS + 1, last + 1)
        block = {"years": [years[0], years[-1]]}
        for dimension in ("gear", "reporting-status"):
            totals = defaultdict(list)
            for r in sau_rows:
                if r["eez"] == eez and r["dimension"] == dimension and r["year"] in years:
                    totals[r["key"]].append(r["tonnes"])
            means = {k: statistics.fmean(v) for k, v in totals.items()}
            grand = sum(means.values())
            block[dimension] = {k: round(v / grand, 4) for k, v in sorted(means.items(), key=lambda kv: -kv[1])}
        summary["seaAroundUs"][eez] = block

    write_json(
        APP_DATA / "fisheries_summary.json",
        {
            "title": "Fisheries catch summary, India and Sri Lanka",
            "sources": {
                "fao": "FAO Global Capture Production 2025.1.0, Major Fishing Area 57 (Indian Ocean, Eastern), CC BY 4.0",
                "seaAroundUs": "Sea Around Us catch reconstruction by EEZ (UBC), CC BY-NC 4.0",
            },
            "generated": date.today().isoformat(),
            "units": "tonnes live weight per year (mean over the years shown)",
            "note": "Country/EEZ-level statistics; they indicate regionally important species and gears, not daily fishing locations.",
        }
        | summary,
        indent=1,
    )


if __name__ == "__main__":
    main()
