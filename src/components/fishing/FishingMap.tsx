import L, { type LatLngBoundsExpression, type LatLngTuple } from "leaflet";
import type { Feature } from "geojson";
import { Fragment } from "react";
import { useEffect, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from "react-leaflet";
import type {
  FishingActivitySnapshot,
  FishingDataResult,
  FishingZone,
} from "../../services/fishing/types";
import { demoMaritimeBoundary } from "../../data/fishing/fishingZones";
import { getActivitySnapshot } from "../../utils/fishing/getActivitySnapshot";
import {
  calculateFishingIntelligence,
  countVesselsInZone,
} from "../../utils/fishing/calculateFishingRisk";

import "leaflet/dist/leaflet.css";

const REGION_CENTER: LatLngTuple = [9.25, 79.05];
const REGION_BOUNDS: LatLngBoundsExpression = [
  [8.1, 77.6],
  [10.3, 80.2],
];

type FishingLayerKey =
  | "activity"
  | "density"
  | "zones"
  | "ocean"
  | "restricted";

const LAYER_OPTIONS: { key: FishingLayerKey; label: string }[] = [
  { key: "activity", label: "Fishing Activity" },
  { key: "density", label: "Vessel Density" },
  { key: "zones", label: "Fishing Zones" },
  { key: "ocean", label: "Ocean Conditions" },
  { key: "restricted", label: "Restricted Areas" },
];

function RegionViewportController() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, pan: false });
    });
    resizeObserver.observe(container);
    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
      map.fitBounds(REGION_BOUNDS, {
        padding: [20, 20],
        maxZoom: 8,
        animate: false,
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
}

function zoneColor(zone: FishingZone, score: number): string {
  if (zone.zoneType === "RESTRICTED") return "#ff465c";
  if (score >= 76) return "#ff465c";
  if (score >= 51) return "#ff9d57";
  if (score >= 26) return "#f5d76e";
  return "#39dce5";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Timestamp unavailable"
    : date.toLocaleString();
}

function DataSourceBadge({ source }: { source: FishingDataResult["source"] }) {
  return (
    <span className={`fishing-source-badge ${source.toLowerCase()}`}>
      <span />
      {source}
    </span>
  );
}

function FishingZoneLayer({
  zone,
  score,
  showActivity,
  onSelect,
  onOpenPopup,
}: {
  zone: FishingZone;
  score: number;
  showActivity: boolean;
  onSelect: (zone: FishingZone) => void;
  onOpenPopup: (popup: L.Popup) => void;
}) {
  const color =
    zone.zoneType === "RESTRICTED"
      ? "#ff465c"
      : showActivity
        ? zoneColor(zone, score)
        : "#39dce5";
  const geoJsonFeature: Feature = {
    type: "Feature",
    properties: { id: zone.id, name: zone.name },
    geometry: zone.geometry,
  };
  const bindZoneInteraction: L.GeoJSONOptions["onEachFeature"] = (
    _feature,
    layer
  ) => {
    layer.on("click", () => onSelect(zone));
    layer.on("popupopen", (event: L.PopupEvent) => onOpenPopup(event.popup));
    const popup = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = zone.name;
    popup.append(
      title,
      document.createElement("br"),
      document.createTextNode(
        zone.zoneType === "RESTRICTED"
          ? `${zone.source === "SIMULATED" ? "DEMO " : ""}RESTRICTED AREA`
          : `ACTIVITY / ${score}%`
      ),
      document.createElement("br"),
      document.createTextNode(`DATA / ${zone.source}`)
    );
    layer.bindPopup(popup);
  };

  return (
    <GeoJSON
      data={geoJsonFeature}
      style={{
        color,
        weight: zone.zoneType === "RESTRICTED" ? 2 : 1.5,
        opacity: 0.85,
        fillColor: color,
        fillOpacity:
          zone.zoneType === "RESTRICTED"
            ? 0.22
            : showActivity
              ? 0.25
              : 0.08,
        dashArray: zone.zoneType === "RESTRICTED" ? "5 6" : undefined,
      }}
      onEachFeature={bindZoneInteraction}
    />
  );
}

function FishingDataPanel({
  zone,
  result,
  intelligence,
  currentIntelligence,
  snapshot,
  detectedVessels,
  onClose,
}: {
  zone: FishingZone;
  result: FishingDataResult;
  intelligence: ReturnType<typeof calculateFishingIntelligence>;
  currentIntelligence: ReturnType<typeof calculateFishingIntelligence>;
  snapshot?: FishingActivitySnapshot;
  detectedVessels: number;
  onClose: () => void;
}) {
  const condition = result.dataset.oceanConditions.reduce<
    (typeof result.dataset.oceanConditions)[number] | undefined
  >((nearest, candidate) => {
    if (!nearest) return candidate;
    const candidateDistance = Math.hypot(
      candidate.latitude - zone.center.latitude,
      candidate.longitude - zone.center.longitude
    );
    const nearestDistance = Math.hypot(
      nearest.latitude - zone.center.latitude,
      nearest.longitude - zone.center.longitude
    );
    return candidateDistance < nearestDistance ? candidate : nearest;
  }, undefined);

  return (
    <aside className="fishing-data-panel" aria-label={`${zone.name} intelligence`}>
      <div className="fishing-data-panel-heading">
        <div>
          <span>REGIONAL INTELLIGENCE</span>
          <h3>{zone.name}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close zone details">
          ×
        </button>
      </div>
      <div className="fishing-data-panel-score">
        <strong>{zone.zoneType === "RESTRICTED" ? "—" : `${intelligence.activityScore}%`}</strong>
        <span>
          {zone.zoneType === "RESTRICTED"
            ? "RESTRICTED AREA"
            : `AI INTELLIGENCE / ${intelligence.riskLevel}`}
        </span>
      </div>
      <dl>
        <div><dt>CURRENT SCORE</dt><dd>{currentIntelligence.activityScore}/100</dd></div>
        <div><dt>CURRENT ACTIVITY</dt><dd>{currentIntelligence.vesselActivity}/100</dd></div>
        <div><dt>SELECTED ACTIVITY</dt><dd>{intelligence.vesselActivity}/100</dd></div>
        <div><dt>HISTORICAL ACTIVITY</dt><dd>{intelligence.historicalActivity}/100</dd></div>
        <div><dt>VESSEL COUNT</dt><dd>{snapshot?.vesselCount ?? zone.vesselCount}</dd></div>
        <div><dt>VESSELS IN FEED</dt><dd>{detectedVessels}</dd></div>
        <div><dt>VESSEL DENSITY</dt><dd>{intelligence.vesselDensity}/100</dd></div>
        <div><dt>ENVIRONMENTAL SCORE</dt><dd>{intelligence.environmentalScore}/100</dd></div>
        <div><dt>OCEAN CONDITIONS</dt><dd>{intelligence.oceanConditionsScore}/100</dd></div>
        {zone.species?.length ? (
          <div><dt>DOMINANT SPECIES</dt><dd>{zone.species.join(", ")}</dd></div>
        ) : null}
        {condition?.seaSurfaceTemperature !== undefined && (
          <div><dt>SST</dt><dd>{condition.seaSurfaceTemperature.toFixed(1)} °C</dd></div>
        )}
        {condition?.waveHeight !== undefined && (
          <div><dt>WAVES</dt><dd>{condition.waveHeight.toFixed(1)} m</dd></div>
        )}
        {condition?.windSpeed !== undefined && (
          <div>
            <dt>WIND</dt>
            <dd>{condition.windSpeed} km/h {condition.windDirection ?? ""}</dd>
          </div>
        )}
        {condition?.currentSpeed !== undefined && (
          <div><dt>OCEAN CURRENT</dt><dd>{condition.currentSpeed.toFixed(1)} m/s</dd></div>
        )}
        {condition?.chlorophyll !== undefined && (
          <div><dt>CHLOROPHYLL</dt><dd>{condition.chlorophyll.toFixed(2)} mg/m³</dd></div>
        )}
        {condition && (
          <div>
            <dt>OCEAN DATA UPDATED</dt>
            <dd>{formatDate(condition.lastUpdated)}</dd>
          </div>
        )}
        <div className="fishing-confidence-row">
          <dt>CONFIDENCE</dt>
          <dd>
            <span className="fishing-confidence-track">
              <i style={{ width: `${intelligence.confidence}%` }} />
            </span>
            {intelligence.confidence}%
          </dd>
        </div>
        <div><dt>DATA SOURCE</dt><dd>{result.source} / {result.dataset.metadata.providerName}</dd></div>
        <div><dt>DATA TIMESTAMP</dt><dd>{formatDate(snapshot?.timestamp ?? zone.timestamp)}</dd></div>
        {condition && (
          <div><dt>OCEAN TIMESTAMP</dt><dd>{formatDate(condition.timestamp)}</dd></div>
        )}
      </dl>
      <p className="fishing-model-note">
        {result.source === "SIMULATED"
          ? "SIMULATED — Prototype intelligence, not official or verified."
          : `LIVE — Source: ${zone.source}. Prototype intelligence score.`}
      </p>
    </aside>
  );
}

export default function FishingMap({
  result,
  loadError,
}: {
  result: FishingDataResult | null;
  loadError: string | null;
}) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null | undefined>(
    undefined
  );
  const [hoursBack, setHoursBack] = useState(0);
  const [enabledLayers, setEnabledLayers] = useState<Record<FishingLayerKey, boolean>>({
    activity: true,
    density: true,
    zones: true,
    ocean: true,
    restricted: true,
  });
  const [openZonePopup, setOpenZonePopup] = useState<L.Popup | null>(null);

  const selectedZone = result?.dataset.zones.find(
    (zone) => zone.id === selectedZoneId
  ) ?? (selectedZoneId === undefined
    ? result?.dataset.zones.find((zone) => zone.zoneType === "FISHING")
    : undefined);
  const selectedSnapshot = selectedZone && result
    ? getActivitySnapshot(
        selectedZone.id,
        result.dataset.activityHistory,
        hoursBack,
        result.dataset.metadata.timestamp
      )
    : undefined;
  const currentSnapshot = selectedZone && result
    ? getActivitySnapshot(
        selectedZone.id,
        result.dataset.activityHistory,
        0,
        result.dataset.metadata.timestamp
      )
    : undefined;
  const selectedIntelligence = selectedZone && result
    ? calculateFishingIntelligence(
        selectedZone,
        result.dataset.vessels,
        result.dataset.oceanConditions,
        selectedSnapshot
      )
    : null;
  const currentIntelligence = selectedZone && result
    ? calculateFishingIntelligence(
        selectedZone,
        result.dataset.vessels,
        result.dataset.oceanConditions,
        currentSnapshot
      )
    : null;
  const selectedVesselCount = selectedZone && result
    ? countVesselsInZone(selectedZone, result.dataset.vessels)
    : 0;

  return (
    <div className="fishing-map">
      <MapContainer
        center={REGION_CENTER}
        zoom={8}
        minZoom={6}
        maxZoom={15}
        scrollWheelZoom
        zoomControl={false}
        className="fishing-leaflet-map"
      >
        <RegionViewportController />
        <TileLayer
          attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <TileLayer
          attribution="Labels &copy; Esri"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
          opacity={0.8}
        />
        <ZoomControl position="bottomleft" />

        <Polyline
          positions={demoMaritimeBoundary}
          pathOptions={{
            color: "#43d9dd",
            weight: 1,
            opacity: 0.55,
            dashArray: "5 7",
          }}
        />

        {result?.dataset.zones.map((zone) => {
          if (zone.zoneType === "RESTRICTED") return null;
          const snapshot = getActivitySnapshot(
            zone.id,
            result.dataset.activityHistory,
            hoursBack,
            result.dataset.metadata.timestamp
          );
          const intelligence = calculateFishingIntelligence(
            zone,
            result.dataset.vessels,
            result.dataset.oceanConditions,
            snapshot
          );
          return (
            <Fragment key={`intelligence-${zone.id}`}>
              {enabledLayers.activity && (
                <CircleMarker
                  center={[zone.center.latitude, zone.center.longitude]}
                  radius={12 + intelligence.activityScore * 0.12}
                  pathOptions={{
                    stroke: false,
                    fillColor: zoneColor(zone, intelligence.activityScore),
                    fillOpacity: 0.12,
                  }}
                  interactive={false}
                />
              )}
              {enabledLayers.density && (
                <CircleMarker
                  center={[zone.center.latitude, zone.center.longitude]}
                  radius={7 + intelligence.vesselDensity * 0.1}
                  pathOptions={{
                    color: "#b9faff",
                    weight: 1,
                    fillColor: "#43d9dd",
                    fillOpacity: 0.07,
                  }}
                  interactive={false}
                />
              )}
            </Fragment>
          );
        })}

        {result?.dataset.zones.map((zone) => {
          if (zone.zoneType === "RESTRICTED" && !enabledLayers.restricted) return null;
          if (zone.zoneType === "FISHING" && !enabledLayers.zones) return null;
          const snapshot = getActivitySnapshot(
            zone.id,
            result.dataset.activityHistory,
            hoursBack,
            result.dataset.metadata.timestamp
          );
          return (
            <FishingZoneLayer
              key={zone.id}
              zone={zone}
              showActivity={enabledLayers.activity}
              score={calculateFishingIntelligence(
                zone,
                result.dataset.vessels,
                result.dataset.oceanConditions,
                snapshot
              ).activityScore}
              onSelect={(clickedZone) => {
                setSelectedZoneId(clickedZone.id);
                openZonePopup?.close();
              }}
              onOpenPopup={setOpenZonePopup}
            />
          );
        })}

        {enabledLayers.ocean && result?.dataset.oceanConditions.map((condition, index) => (
          <CircleMarker
            key={`ocean-${condition.latitude}-${condition.longitude}`}
            center={[condition.latitude, condition.longitude]}
            radius={7}
            pathOptions={{
              color: "#75e7bd",
              weight: 1.5,
              fillColor: "#75e7bd",
              fillOpacity: 0.35,
            }}
          >
            <Popup>
              <strong>OCEAN CONDITIONS / {condition.source} / {index + 1}</strong>
              <br />
              SST {condition.seaSurfaceTemperature?.toFixed(1) ?? "—"} °C
              <br />
              Waves {condition.waveHeight?.toFixed(1) ?? "—"} m
              <br />
              Wind {condition.windSpeed ?? "—"} km/h {condition.windDirection ?? ""}
              <br />
              Current {condition.currentSpeed?.toFixed(1) ?? "—"} m/s
              <br />
              Chlorophyll {condition.chlorophyll?.toFixed(2) ?? "—"} mg/m³
              <br />
              {condition.source} / {Math.round(condition.confidence * 100)}% CONFIDENCE
              <br />
              {formatDate(condition.timestamp)}
            </Popup>
          </CircleMarker>
        ))}

        {result?.dataset.vessels.map((vessel) => {
          const icon = L.divIcon({
            className: "fishing-vessel-marker",
            html: `<span style="--vessel-heading:${vessel.heading ?? 0}deg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 19 21 12 17 5 21 12 2Z"/></svg></span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          return (
            <Marker
              key={vessel.id}
              position={[vessel.latitude, vessel.longitude]}
              icon={icon}
            >
              <Popup>
                <strong>{vessel.source} FISHING VESSEL</strong>
                <br />
                {vessel.id} / {vessel.source}
                <br />
                Heading {vessel.heading ?? "—"}° · Speed {vessel.speed ?? "—"} kn
                <br />
                Confidence {Math.round(vessel.confidence * 100)}%
                <br />
                Updated {formatDate(vessel.timestamp)}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="fishing-map-hud">
        <div className="fishing-map-heading">
          <span>GEOGRAPHIC INTELLIGENCE / {result?.source ?? "LOADING"}</span>
          <h3>GULF OF MANNAR · PALK BAY</h3>
          <small>Southern Tamil Nadu / Northern Sri Lanka</small>
        </div>
        {result ? (
          <DataSourceBadge source={result.source} />
        ) : (
          <span className="fishing-source-badge loading">LOADING DATA</span>
        )}
        <details className="fishing-map-layer-control">
          <summary>MAP LAYERS / LEGEND</summary>
          <div className="fishing-map-layer-content">
            <div className="fishing-map-legend">
              <strong>FISHING ACTIVITY</strong>
              <span><i className="low" /> LOW</span>
              <span><i className="moderate" /> MODERATE</span>
              <span><i className="high" /> HIGH</span>
              <span><i className="critical" /> CRITICAL</span>
              <span><i className="restricted" /> RESTRICTED</span>
              <span><i className="boundary" /> DEMO BOUNDARY</span>
            </div>
            <div className="fishing-layer-toggles" aria-label="Map layers">
              {LAYER_OPTIONS.map(({ key, label }) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={enabledLayers[key]}
                    onChange={(event) =>
                      setEnabledLayers((current) => ({
                        ...current,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </details>
        <p className="fishing-map-source-note" title={result?.notice}>
          {result?.source === "SIMULATED"
            ? `SIMULATED · Prototype intelligence — not official or verified.${result.notice ? " Live source unavailable." : ""}`
            : result?.source === "LIVE"
                ? `LIVE · Source: ${result.dataset.metadata.providerName}`
                : `CACHED · Last available normalized dataset${result?.notice ? " · Live source unavailable" : ""}`}
        </p>
        <div className="fishing-time-control">
          <div>
            <span>ACTIVITY WINDOW</span>
            <strong>{hoursBack === 0 ? "CURRENT" : `${hoursBack} HOURS AGO`}</strong>
          </div>
          <input
            aria-label="Fishing activity time window in hours"
            type="range"
            min="0"
            max="24"
            step="1"
            value={hoursBack}
            onChange={(event) => setHoursBack(Number(event.target.value))}
          />
          <div className="fishing-time-labels">
            <span>CURRENT</span>
            <span>24 HOURS</span>
          </div>
        </div>
      </div>

      {loadError && (
        <p className="fishing-data-notice error" role="alert">
          {loadError}
        </p>
      )}

      {result && selectedZone && selectedIntelligence && (
        <FishingDataPanel
          zone={selectedZone}
          result={result}
          intelligence={selectedIntelligence}
          currentIntelligence={currentIntelligence ?? selectedIntelligence}
          snapshot={selectedSnapshot}
          detectedVessels={selectedVesselCount}
          onClose={() => setSelectedZoneId(null)}
        />
      )}
    </div>
  );
}
