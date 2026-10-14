import L, { type LatLngBoundsExpression, type LatLngTuple } from "leaflet";
import type { Feature } from "geojson";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
  FishingVessel,
  FishingZone,
  GeoPosition,
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
const DEMO_TRACKING_TIME_SCALE = 48;
const MAX_VESSEL_TRAIL_POINTS = 28;

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

function pointInRing(longitude: number, latitude: number, ring: GeoPosition[]) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function isInsideZone(latitude: number, longitude: number, zone: FishingZone) {
  const polygons = zone.geometry.type === "Polygon"
    ? [zone.geometry.coordinates]
    : zone.geometry.coordinates;

  return polygons.some((polygon) => {
    const [outerRing, ...holes] = polygon;
    return (
      pointInRing(longitude, latitude, outerRing) &&
      !holes.some((hole) => pointInRing(longitude, latitude, hole))
    );
  });
}

function isSafeTrackSegment(
  start: LatLngTuple,
  end: LatLngTuple,
  operatingZone: FishingZone,
  restrictedZones: FishingZone[]
) {
  for (let step = 0; step <= 12; step++) {
    const fraction = step / 12;
    const latitude = start[0] + (end[0] - start[0]) * fraction;
    const longitude = start[1] + (end[1] - start[1]) * fraction;
    if (
      !isInsideZone(latitude, longitude, operatingZone) ||
      restrictedZones.some((zone) => isInsideZone(latitude, longitude, zone))
    ) {
      return false;
    }
  }

  return true;
}

function createSeededRandom(value: string) {
  let seed = 2166136261;
  for (let index = 0; index < value.length; index++) {
    seed = Math.imul(seed ^ value.charCodeAt(index), 16777619);
  }

  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function chooseNearbyTarget(
  position: LatLngTuple,
  operatingZone: FishingZone,
  restrictedZones: FishingZone[],
  random: () => number
): LatLngTuple {
  for (let attempt = 0; attempt < 32; attempt++) {
    const bearing = random() * Math.PI * 2;
    const distanceKm = 0.2 + random() * 0.8;
    const latitudeOffset = (Math.cos(bearing) * distanceKm) / 111.32;
    const longitudeOffset =
      (Math.sin(bearing) * distanceKm) /
      (111.32 * Math.cos((position[0] * Math.PI) / 180));
    const candidate: LatLngTuple = [
      position[0] + latitudeOffset,
      position[1] + longitudeOffset,
    ];

    if (isSafeTrackSegment(position, candidate, operatingZone, restrictedZones)) {
      return candidate;
    }
  }

  const center: LatLngTuple = [
    operatingZone.center.latitude,
    operatingZone.center.longitude,
  ];
  for (const fraction of [0.15, 0.3, 0.45]) {
    const candidate: LatLngTuple = [
      position[0] + (center[0] - position[0]) * fraction,
      position[1] + (center[1] - position[1]) * fraction,
    ];
    if (isSafeTrackSegment(position, candidate, operatingZone, restrictedZones)) {
      return candidate;
    }
  }

  return position;
}

function seededHeadingPulse(vesselId: string) {
  return vesselId.split("").reduce((hash, character) => hash + character.charCodeAt(0), 0) % 3 === 0;
}

function createVesselIcon(vessel: FishingVessel) {
  const heading = vessel.heading ?? 0;
  const pulseClass = seededHeadingPulse(vessel.id) ? " is-pulsing" : "";
  return L.divIcon({
    className: "fishing-vessel-marker",
    html: `<span class="fishing-vessel-core${pulseClass}" style="--vessel-heading:${heading}deg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 19 21 12 17 5 21 12 2Z"/></svg></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function rotateHeadingToward(current: number, target: number, maximumStep: number) {
  const difference = ((target - current + 540) % 360) - 180;
  const step = Math.sign(difference) * Math.min(Math.abs(difference), maximumStep);
  return (current + step + 360) % 360;
}

function headingBetween(start: LatLngTuple, end: LatLngTuple) {
  const north = end[0] - start[0];
  const east = (end[1] - start[1]) * Math.cos((start[0] * Math.PI) / 180);
  return (((Math.atan2(east, north) * 180) / Math.PI) + 360) % 360;
}

function distanceMeters(start: LatLngTuple, end: LatLngTuple) {
  const north = (end[0] - start[0]) * 111_320;
  const east =
    (end[1] - start[1]) *
    111_320 *
    Math.cos((start[0] * Math.PI) / 180);
  return Math.hypot(north, east);
}

function TrackedVesselMarker({
  vessel,
  operatingZone,
  restrictedZones,
  simulate,
}: {
  vessel: FishingVessel;
  operatingZone?: FishingZone;
  restrictedZones: FishingZone[];
  simulate: boolean;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const position = useMemo<LatLngTuple>(
    () => [vessel.latitude, vessel.longitude],
    [vessel.latitude, vessel.longitude]
  );
  const initialTrailPositions = useMemo<[LatLngTuple, LatLngTuple]>(
    () => [position, position],
    [position]
  );
  const icon = useMemo(() => createVesselIcon(vessel), [vessel]);
  const [telemetry, setTelemetry] = useState({
    heading: Math.round(vessel.heading ?? 0),
    speed: vessel.speed ?? 0,
  });

  useEffect(() => {
    const marker = markerRef.current;
    if (!simulate || !operatingZone || !marker) return;

    const random = createSeededRandom(vessel.id);
    const track = {
      position: [...position] as LatLngTuple,
      target: [...position] as LatLngTuple,
      heading: vessel.heading ?? random() * 360,
      baseSpeed: Math.max(1.5, Math.min(vessel.speed ?? 3.2, 6)),
      currentSpeed: vessel.speed ?? 3.2,
      phase: random() * Math.PI * 2,
      trail: [[...position] as LatLngTuple],
    };
    track.target = chooseNearbyTarget(
      track.position,
      operatingZone,
      restrictedZones,
      random
    );

    let previousFrame = performance.now();
    let lastTrailPoint = previousFrame;
    let lastTelemetryUpdate = previousFrame;
    let animationFrame = 0;
    const core = marker.getElement()?.querySelector<HTMLElement>(".fishing-vessel-core");
    const headingIcon = core?.querySelector<SVGElement>("svg");

    const animate = (now: number) => {
      const deltaSeconds = Math.min((now - previousFrame) / 1000, 0.06);
      previousFrame = now;
      track.currentSpeed = Math.max(
        1.5,
        Math.min(
          6,
          track.baseSpeed *
            (1 + 0.09 * Math.sin(now / 6_500 + track.phase) + 0.04 * Math.sin(now / 11_000 + track.phase))
        )
      );

      const remainingMeters = distanceMeters(track.position, track.target);
      if (remainingMeters <= 0.05) {
        track.position = [...track.target];
        track.target = chooseNearbyTarget(
          track.position,
          operatingZone,
          restrictedZones,
          random
        );
      } else {
        const desiredHeading = headingBetween(track.position, track.target);
        track.heading = rotateHeadingToward(
          track.heading,
          desiredHeading,
          75 * deltaSeconds
        );
        const travelMeters =
          (track.currentSpeed * 0.514444 * DEMO_TRACKING_TIME_SCALE) * deltaSeconds;
        const fraction = Math.min(1, travelMeters / remainingMeters);
        track.position = [
          track.position[0] + (track.target[0] - track.position[0]) * fraction,
          track.position[1] + (track.target[1] - track.position[1]) * fraction,
        ];
      }

      marker.setLatLng(track.position);
      if (core) {
        const roundedPoint = map.latLngToLayerPoint(track.position);
        const precisePoint = map
          .project(track.position, map.getZoom())
          .subtract(map.getPixelOrigin());
        core.style.transform = `translate3d(${precisePoint.x - roundedPoint.x}px, ${precisePoint.y - roundedPoint.y}px, 0)`;
        core.style.setProperty("--vessel-heading", `${track.heading}deg`);
      }
      if (headingIcon) headingIcon.style.transform = `rotate(${track.heading}deg)`;

      if (now - lastTrailPoint >= 700) {
        track.trail.push([...track.position]);
        if (track.trail.length > MAX_VESSEL_TRAIL_POINTS) track.trail.shift();
        trailRef.current?.setLatLngs(track.trail);
        lastTrailPoint = now;
      }

      if (now - lastTelemetryUpdate >= 1_500) {
        setTelemetry({
          heading: Math.round(track.heading),
          speed: Number(track.currentSpeed.toFixed(1)),
        });
        lastTelemetryUpdate = now;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [map, operatingZone, position, restrictedZones, simulate, vessel]);

  return (
    <Fragment>
      {simulate && operatingZone && (
        <Polyline
          ref={trailRef}
          positions={initialTrailPositions}
          pathOptions={{
            color: "#43d9dd",
            weight: 1.5,
            opacity: 0.42,
            lineCap: "round",
            lineJoin: "round",
          }}
          interactive={false}
        />
      )}
      <Marker ref={markerRef} position={position} icon={icon}>
        <Popup>
          <strong>{simulate ? "SIMULATED DEMO" : vessel.source} FISHING VESSEL</strong>
          <br />
          {vessel.id} / {simulate ? "DEMO TRACKING" : vessel.source}
          <br />
          Heading {simulate ? telemetry.heading : vessel.heading ?? "—"}° · Speed {simulate ? telemetry.speed : vessel.speed ?? "—"} kn
          <br />
          {operatingZone ? `ZONE / ${operatingZone.name}` : "POSITION / SOURCE FEED"}
          <br />
          Confidence {Math.round(vessel.confidence * 100)}%
          <br />
          Updated {formatDate(vessel.timestamp)}
        </Popup>
      </Marker>
    </Fragment>
  );
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
  const activityBand = zone.zoneType === "RESTRICTED"
    ? "critical"
    : !showActivity
      ? "safe"
      : score >= 76
      ? "critical"
      : score >= 51
        ? "high"
        : score >= 26
          ? "caution"
          : "safe";
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
        className: `fishing-zone-path fishing-zone-path-${activityBand}`,
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
  snapshot,
  detectedVessels,
  onClose,
}: {
  zone: FishingZone;
  result: FishingDataResult;
  intelligence: ReturnType<typeof calculateFishingIntelligence>;
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
        <div><dt>CURRENT SCORE</dt><dd>{intelligence.activityScore}/100</dd></div>
        <div><dt>CURRENT ACTIVITY</dt><dd>{intelligence.vesselActivity}/100</dd></div>
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
  const [enabledLayers, setEnabledLayers] = useState<Record<FishingLayerKey, boolean>>({
    activity: true,
    density: true,
    zones: true,
    ocean: true,
    restricted: true,
  });
  const [openZonePopup, setOpenZonePopup] = useState<L.Popup | null>(null);
  const zones = useMemo(() => result?.dataset.zones ?? [], [result?.dataset.zones]);
  const restrictedZones = useMemo(
    () => zones.filter((zone) => zone.zoneType === "RESTRICTED"),
    [zones]
  );
  const simulatedTracking = Boolean(
    result && (
      result.source === "SIMULATED" ||
      result.dataset.metadata.providerName === "Deterministic demo dataset"
    )
  );

  const selectedZone = result?.dataset.zones.find(
    (zone) => zone.id === selectedZoneId
  ) ?? (selectedZoneId === undefined
    ? result?.dataset.zones.find((zone) => zone.zoneType === "FISHING")
    : undefined);
  const selectedSnapshot = selectedZone && result
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
            0,
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
            0,
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
          const operatingZone = simulatedTracking
            ? zones.find((zone) =>
                zone.zoneType === "FISHING" &&
                isInsideZone(vessel.latitude, vessel.longitude, zone)
              )
            : undefined;

          return (
            <TrackedVesselMarker
              key={vessel.id}
              vessel={vessel}
              operatingZone={operatingZone}
              restrictedZones={restrictedZones}
              simulate={simulatedTracking}
            />
          );
        })}
      </MapContainer>

      <div className="fishing-map-hud">
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
          snapshot={selectedSnapshot}
          detectedVessels={selectedVesselCount}
          onClose={() => setSelectedZoneId(null)}
        />
      )}
    </div>
  );
}
