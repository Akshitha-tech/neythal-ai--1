import {
  MapContainer,
  TileLayer,
  Polyline,
  Polygon,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import { useEffect, useRef, useState } from "react";

// Natural Earth 1:10m admin boundaries (public domain), not navigation-grade charts.
import landMask from "./data/palk-strait-land.json";
import {
  SAFETY_ALERT_CONTENT,
  type SafetyAlertLanguage,
  type SafetyZone,
} from "./neythalAI";

import "leaflet/dist/leaflet.css";

type Props = {
  onSafetyChange?: (zone: SafetyZone) => void;
  alertLanguage: SafetyAlertLanguage;
  onAlertLanguageChange: (language: SafetyAlertLanguage) => void;
  voiceStatus: string | null;
};

/* =========================================================
   PROTOTYPE PALK STRAIT BOUNDARY
   ---------------------------------------------------------
   DEMO COORDINATES ONLY.
   Replace with verified official boundary data
   before real-world deployment.
========================================================= */

const maritimeBoundary: [number, number][] = [
  [10.0833, 80.05],
  [9.95, 79.5833],
  [9.6694, 79.3767],
  [9.3639, 79.5111],
  [9.2167, 79.5333],
  [9.1, 79.5333],
];

/* =========================================================
   INDIAN-SIDE DEMO NAVIGATION AREA
========================================================= */

const indianNavigationZone: [number, number][] = [
  [10.25, 78.95],
  [10.25, 79.48],
  [10.05, 79.48],
  [9.95, 79.4],
  [9.75, 79.25],
  [9.55, 79.28],
  [9.35, 79.4],
  [9.1, 79.4],
  [8.95, 79.15],
  [8.95, 78.85],
];

const OCEAN_REGION_BOUNDS = {
  south: 8.1,
  north: 10.3,
  west: 77.6,
  east: 80.2,
};

const BOAT_ROUTE: [number, number][] = [
  [9.78, 79.3],
  [9.85, 79.4],
  [9.85, 79.6],
  [9.7, 79.6],
  [9.75, 79.7],
  [9.7, 79.4],
  [9.7, 79.3],
  [9.7, 79.3],
  [9.6, 79.5],
  [9.4, 79.45],
  [9.36, 79.5],
  [9.4, 79.45],
  [9.6, 79.5],
  [9.7, 79.3],
  [9.78, 79.3],
];

type LandGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

const LAND_GEOMETRIES = landMask.features.map(
  (feature) => feature.geometry as LandGeometry
);

const BOAT_FOOTPRINT_OFFSETS: [number, number][] = [
  [-50, -50],
  [0, -50],
  [50, -50],
  [-50, 0],
  [50, 0],
  [-50, 50],
  [0, 50],
  [50, 50],
];

const CURRENT_ZONE_LABEL: Record<SafetyAlertLanguage, string> = {
  en: "CURRENT ZONE",
  ta: "தற்போதைய மண்டலம்",
  ml: "നിലവിലെ മേഖല",
};

/* =========================================================
   INITIAL BOAT POSITION
========================================================= */

const initialBoatPosition: [number, number] = [
  9.78,
  79.3,
];

/* =========================================================
   3D FISHING BOAT ICON
========================================================= */

const boatIcon = L.divIcon({
  className: "neythal-3d-boat-marker",

  html: `
    <div class="neythal-vessel">

      <div class="vessel-radar-ring"></div>

      <div class="vessel-shadow"></div>

      <div class="vessel-body">

        <div class="vessel-hull"></div>

        <div class="vessel-deck"></div>

        <div class="vessel-cabin">
          <div class="vessel-window"></div>
          <div class="vessel-window"></div>
          <div class="vessel-window"></div>
        </div>

        <div class="vessel-mast"></div>

        <div class="vessel-light"></div>

      </div>

      <div class="vessel-heading">
        ↑
      </div>

    </div>
  `,

  iconSize: [100, 100],
  iconAnchor: [50, 50],
});

function ZoneIcon({ zone }: { zone: SafetyZone }) {
  if (zone === "SAFE") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2.8 19 5.6v5.7c0 4.4-2.9 8-7 9.9-4.1-1.9-7-5.5-7-9.9V5.6l7-2.8Z" />
        <path d="m8.8 11.8 2.1 2.1 4.4-4.5" />
      </svg>
    );
  }

  if (zone === "CRITICAL") {
    return (
      <svg
        className="critical-zone-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="m9 9 6 6m0-6-6 6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <path
        d={zone === "CAUTION" ? "M12 10.8v4.5m0-7.2h.01" : "M12 7.5v6m0 3h.01"}
      />
    </svg>
  );
}

/* =========================================================
   MAP CAMERA
========================================================= */

function MapCamera({
  mapRef,
}: {
  mapRef: { current: L.Map | null };
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    map.setView([9.55, 79.35], 9.4);

    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);

  return null;
}

/* =========================================================
   DISTANCE
========================================================= */

function distanceKm(
  a: [number, number],
  b: [number, number]
) {
  const R = 6371;

  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;

  const dLat =
    ((b[0] - a[0]) * Math.PI) / 180;

  const dLng =
    ((b[1] - a[1]) * Math.PI) / 180;

  const x =
    dLng *
    Math.cos((lat1 + lat2) / 2);

  const y = dLat;

  return Math.sqrt(x * x + y * y) * R;
}

/* =========================================================
   NEAREST BOUNDARY DISTANCE
========================================================= */

function getNearestBoundaryDistance(
  boat: [number, number]
) {
  let minimumDistance =
    Number.POSITIVE_INFINITY;

  for (
    let i = 0;
    i < maritimeBoundary.length - 1;
    i++
  ) {
    const start = maritimeBoundary[i];
    const end = maritimeBoundary[i + 1];

    const samples = 40;

    for (
      let j = 0;
      j <= samples;
      j++
    ) {
      const t = j / samples;

      const point: [number, number] = [
        start[0] +
          (end[0] - start[0]) * t,

        start[1] +
          (end[1] - start[1]) * t,
      ];

      const distance =
        distanceKm(boat, point);

      if (
        distance <
        minimumDistance
      ) {
        minimumDistance = distance;
      }
    }
  }

  return minimumDistance;
}

/* =========================================================
   SAFETY CALCULATION
========================================================= */

function getCurrentZone(
  latitude: number,
  longitude: number
): SafetyZone {
  const distance = getNearestBoundaryDistance([latitude, longitude]);

  if (distance <= 2) {
    return "CRITICAL";
  }

  if (distance <= 5) {
    return "WARNING";
  }

  if (distance <= 10) {
    return "CAUTION";
  }

  return "SAFE";
}

/* =========================================================
   COASTLINE VALIDATION
========================================================= */

function isPointInRing(
  point: [number, number],
  ring: number[][]
): boolean {
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

function isInsideLandPolygon(
  point: [number, number],
  polygon: number[][][]
): boolean {
  return isPointInRing(point, polygon[0]);
}

function isLand(point: [number, number]): boolean {
  return LAND_GEOMETRIES.some((geometry) => {
    if (geometry.type === "Polygon") {
      return isInsideLandPolygon(point, geometry.coordinates);
    }

    return geometry.coordinates.some((polygon) =>
      isInsideLandPolygon(point, polygon)
    );
  });
}

function isWithinOceanRegion(point: [number, number]): boolean {
  const [latitude, longitude] = point;

  return (
    latitude >= OCEAN_REGION_BOUNDS.south &&
    latitude <= OCEAN_REGION_BOUNDS.north &&
    longitude >= OCEAN_REGION_BOUNDS.west &&
    longitude <= OCEAN_REGION_BOUNDS.east
  );
}

function isValidOceanPosition(
  position: [number, number],
  map: L.Map | null
): boolean {
  if (!isWithinOceanRegion(position) || isLand(position)) {
    return false;
  }

  if (!map) {
    return true;
  }

  const pixel = map.latLngToContainerPoint(position);

  return BOAT_FOOTPRINT_OFFSETS.every(([offsetX, offsetY]) => {
    const footprintPoint = map.containerPointToLatLng([
      pixel.x + offsetX,
      pixel.y + offsetY,
    ]);
    const geographicPoint: [number, number] = [
      footprintPoint.lat,
      footprintPoint.lng,
    ];

    return (
      isWithinOceanRegion(geographicPoint) &&
      !isLand(geographicPoint)
    );
  });
}

function isClearOceanPath(
  start: [number, number],
  end: [number, number],
  map: L.Map
): boolean {
  const steps = Math.ceil(distanceKm(start, end) / 0.5);

  for (let step = 1; step < steps; step++) {
    const fraction = step / steps;
    const position: [number, number] = [
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction,
    ];

    if (!isValidOceanPosition(position, map)) {
      return false;
    }
  }

  return isValidOceanPosition(end, map);
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function MaritimeMap({
  onSafetyChange,
  alertLanguage,
  onAlertLanguageChange,
  voiceStatus,
}: Props) {
  const [
    boatPosition,
    setBoatPosition,
  ] = useState<[number, number]>(
    initialBoatPosition
  );

  const mapRef = useRef<L.Map | null>(null);
  const boatMarkerRef = useRef<L.Marker | null>(null);
  const boatPositionRef = useRef<[number, number]>(initialBoatPosition);
  const draggingRef = useRef(false);
  const waypointIndexRef = useRef(0);
  const routeDirectionRef = useRef(1);
  const lastStateUpdateRef = useRef(0);
  const lastTrailUpdateRef = useRef(0);

  const boundaryDistance =
    getNearestBoundaryDistance(boatPosition);

  const safetyZone =
    getCurrentZone(boatPosition[0], boatPosition[1]);
  const zoneContent = SAFETY_ALERT_CONTENT[alertLanguage][safetyZone];

  const previousSafetyZone =
    useRef<SafetyZone>(safetyZone);

  const [
    boatTrail,
    setBoatTrail,
  ] = useState<
    [number, number][]
  >([initialBoatPosition]);

  /* =======================================================
     SAFETY CALCULATION
  ======================================================= */

  useEffect(() => {
    if (previousSafetyZone.current !== safetyZone) {
      previousSafetyZone.current = safetyZone;
      onSafetyChange?.(safetyZone);
    }
  }, [
    safetyZone,
    onSafetyChange,
  ]);

  /* =======================================================
     AUTOMATIC BOAT MOVEMENT
  ======================================================= */

  useEffect(() => {
    let frameId = 0;
    let previousFrameTime: number | null = null;

    const animate = (time: number) => {
      const elapsedSeconds =
        previousFrameTime === null
          ? 0
          : Math.min((time - previousFrameTime) / 1000, 0.1);
      previousFrameTime = time;

      if (!draggingRef.current && elapsedSeconds > 0) {
        const storedTargetIndex = waypointIndexRef.current;
        const targetIndex =
          Number.isInteger(storedTargetIndex) &&
          storedTargetIndex >= 0 &&
          storedTargetIndex < BOAT_ROUTE.length
            ? storedTargetIndex
            : 0;

        if (targetIndex !== storedTargetIndex) {
          console.warn("Invalid boat route index; restarting the route.");
          waypointIndexRef.current = targetIndex;
          routeDirectionRef.current = 1;
        }

        const target = BOAT_ROUTE[targetIndex];
        const current = boatPositionRef.current;
        const remainingDistance = distanceKm(current, target);

        if (remainingDistance <= 0.025) {
          const nextIndex =
            targetIndex + routeDirectionRef.current;

          if (nextIndex < 0 || nextIndex >= BOAT_ROUTE.length) {
            routeDirectionRef.current *= -1;
          } else {
            waypointIndexRef.current = nextIndex;
          }
        } else {
          const stepDistance = Math.min(
            0.0062 * elapsedSeconds,
            remainingDistance
          );
          const fraction = stepDistance / remainingDistance;
          const proposedPosition: [number, number] = [
            current[0] + (target[0] - current[0]) * fraction,
            current[1] + (target[1] - current[1]) * fraction,
          ];

          if (isValidOceanPosition(proposedPosition, mapRef.current)) {
            boatPositionRef.current = proposedPosition;
            boatMarkerRef.current?.setLatLng(proposedPosition);

            if (time - lastStateUpdateRef.current >= 200) {
              lastStateUpdateRef.current = time;
              setBoatPosition(proposedPosition);
            }

            if (time - lastTrailUpdateRef.current >= 2500) {
              lastTrailUpdateRef.current = time;
              setBoatTrail((previous) =>
                [...previous, proposedPosition].slice(-48)
              );
            }
          } else {
            const reverseDirection = -routeDirectionRef.current;
            const reverseIndex = targetIndex + reverseDirection;

            if (reverseIndex < 0 || reverseIndex >= BOAT_ROUTE.length) {
              routeDirectionRef.current = targetIndex === 0 ? 1 : -1;
              waypointIndexRef.current =
                targetIndex + routeDirectionRef.current;
            } else {
              routeDirectionRef.current = reverseDirection;
              waypointIndexRef.current = reverseIndex;
            }
          }
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleBoatDragStart = () => {
    draggingRef.current = true;
  };

  const handleBoatDrag = (event: L.LeafletEvent) => {
    const marker =
      event.target as L.Marker;

    const position =
      marker.getLatLng();

    const requestedPosition: [
      number,
      number
    ] = [
      position.lat,
      position.lng,
    ];

    const map = mapRef.current;
    if (
      isValidOceanPosition(requestedPosition, map) &&
      (!map || isClearOceanPath(boatPositionRef.current, requestedPosition, map))
    ) {
      boatPositionRef.current = requestedPosition;
      setBoatPosition(requestedPosition);
      return;
    }

    marker.setLatLng(boatPositionRef.current);
  };

  const handleBoatDragEnd = (event: L.LeafletEvent) => {
    draggingRef.current = false;
    handleBoatDrag(event);

    const map = mapRef.current;
    if (!map) return;

    let nearestRouteIndex = 0;
    let nearestRouteDistance = Number.POSITIVE_INFINITY;

    BOAT_ROUTE.forEach((waypoint, index) => {
      const distance = distanceKm(boatPositionRef.current, waypoint);
      if (distance < nearestRouteDistance) {
        nearestRouteDistance = distance;
        nearestRouteIndex = index;
      }
    });

    for (let offset = 0; offset < BOAT_ROUTE.length; offset++) {
      const index = (nearestRouteIndex + offset) % BOAT_ROUTE.length;
      if (isClearOceanPath(boatPositionRef.current, BOAT_ROUTE[index], map)) {
        waypointIndexRef.current = index;
        routeDirectionRef.current = index === BOAT_ROUTE.length - 1 ? -1 : 1;
        break;
      }
    }

    setBoatTrail((previous) =>
      [...previous, boatPositionRef.current].slice(-48)
    );
  };

  return (
    <section className="palk-safety-system">

      {/* =================================================
          TITLE
      ================================================= */}

      <div className="palk-map-title">

        <div>
          <span>
            NEYTHAL / 06
          </span>

          <h2>
            PALK STRAIT
          </h2>

          <p>
            LIVE MARITIME SAFETY MONITOR
          </p>
        </div>

        <div className="palk-language-control">
          <label htmlFor="maritime-alert-language">
            ALERT LANGUAGE
          </label>
          <span className="palk-language-select">
            <select
              id="maritime-alert-language"
              title="Alert Language"
              aria-label="Alert Language"
              value={alertLanguage}
              onChange={(event) => {
                const language = event.currentTarget.value;
                if (language === "en" || language === "ta" || language === "ml") {
                  onAlertLanguageChange(language);
                }
              }}
            >
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
              <option value="ml">മലയാളം</option>
            </select>
          </span>
        </div>

        <div
          className={`palk-live-status ${safetyZone.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >
          <ZoneIcon zone={safetyZone} />
          <strong className="palk-live-status-label">{zoneContent.label}</strong>
        </div>

      </div>

      {/* =================================================
          MAP
      ================================================= */}

      <div className="palk-map-wrapper">

        <MapContainer
          center={[9.55, 79.35]}
          zoom={9.4}
          zoomControl={true}
          scrollWheelZoom={true}
          className="palk-map"
        >

          <MapCamera mapRef={mapRef} />

          {/* =================================================
              DARK MARITIME BASE MAP
          ================================================= */}

          {/* =================================================
    REAL SATELLITE BASE MAP
================================================= */}

<TileLayer
  attribution="© Esri, Maxar, Earthstar Geographics"
  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  maxZoom={19}
/>

{/* =================================================
    MAP LABELS
================================================= */}

<TileLayer
  attribution="© Esri"
  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
  maxZoom={19}
  opacity={0.85}
/>

          {/* =================================================
              INDIAN NAVIGATION ZONE
          ================================================= */}

          <Polygon
            positions={
              indianNavigationZone
            }
            pathOptions={{
              color: "#39dce5",
              weight: 1,
              opacity: 0.35,
              fillColor: "#087c91",
              fillOpacity: 0.06,
            }}
          />

          {/* =================================================
              SAFE ZONE
          ================================================= */}

          <Polygon
            positions={[
              ...maritimeBoundary,
              ...maritimeBoundary
                .slice()
                .reverse()
                .map(
                  ([lat, lng]) =>
                    [
                      lat,
                      lng - 0.42,
                    ] as [
                      number,
                      number
                    ]
                ),
            ]}
            pathOptions={{
              color: "#39dce5",
              weight: 1,
              opacity: 0.25,
              fillColor: "#39dce5",
              fillOpacity: 0.035,
            }}
          />

          {/* =================================================
              CAUTION ZONE
          ================================================= */}

          <Polygon
            positions={[
              ...maritimeBoundary,
              ...maritimeBoundary
                .slice()
                .reverse()
                .map(
                  ([lat, lng]) =>
                    [
                      lat,
                      lng - 0.22,
                    ] as [
                      number,
                      number
                    ]
                ),
            ]}
            pathOptions={{
              color: "#f5d76e",
              weight: 1,
              opacity: 0.4,
              fillColor: "#f5d76e",
              fillOpacity: 0.05,
              dashArray: "6 10",
            }}
          />

          {/* =================================================
              WARNING ZONE
          ================================================= */}

          <Polygon
            positions={[
              ...maritimeBoundary,
              ...maritimeBoundary
                .slice()
                .reverse()
                .map(
                  ([lat, lng]) =>
                    [
                      lat,
                      lng - 0.11,
                    ] as [
                      number,
                      number
                    ]
                ),
            ]}
            pathOptions={{
              color: "#ff9d57",
              weight: 1,
              opacity: 0.5,
              fillColor: "#ff9d57",
              fillOpacity: 0.06,
              dashArray: "5 8",
            }}
          />

          {/* =================================================
              CRITICAL ZONE
          ================================================= */}

          <Polygon
            positions={[
              ...maritimeBoundary,
              ...maritimeBoundary
                .slice()
                .reverse()
                .map(
                  ([lat, lng]) =>
                    [
                      lat,
                      lng - 0.045,
                    ] as [
                      number,
                      number
                    ]
                ),
            ]}
            pathOptions={{
              color: "#ff465c",
              weight: 2,
              opacity: 0.7,
              fillColor: "#ff465c",
              fillOpacity: 0.09,
              dashArray: "3 6",
            }}
          />

      

          {/* =================================================
              VESSEL TRAIL
          ================================================= */}

          {boatTrail.length > 1 && (
            <Polyline
              positions={boatTrail}
              pathOptions={{
                color: "#39dce5",
                weight: 3,
                opacity: 0.65,
                dashArray: "4 8",
                className:
                  "neythal-vessel-trail",
              }}
            />
          )}

          {/* =================================================
              VESSEL POSITION GLOW
          ================================================= */}

          <Circle
            center={boatPosition}
            radius={700}
            pathOptions={{
              color: "#39dce5",
              weight: 1,
              opacity: 0.25,
              fillColor: "#39dce5",
              fillOpacity: 0.035,
            }}
          />

          <Circle
            center={boatPosition}
            radius={180}
            pathOptions={{
              color: "#39dce5",
              weight: 1,
              opacity: 0.5,
              fillColor: "#39dce5",
              fillOpacity: 0.08,
            }}
          />

          {/* =================================================
              3D FISHING VESSEL
          ================================================= */}

          <Marker
            ref={boatMarkerRef}
            position={boatPosition}
            icon={boatIcon}
            draggable={true}
            eventHandlers={{
              dragstart: handleBoatDragStart,
              drag: handleBoatDrag,
              dragend: handleBoatDragEnd,
            }}
          >

            <Popup>

              <strong>
                NEYTHAL FISHING VESSEL
              </strong>

              <br />

              GPS MONITORING: ACTIVE

              <br />

              BOUNDARY:

              {" "}

              {boundaryDistance.toFixed(
                1
              )}

              {" "}KM

              <br />

              STATUS:

              {" "}

              {zoneContent.label}

            </Popup>

          </Marker>

        </MapContainer>

        {/* =================================================
            TOP INSTRUCTION
        ================================================= */}

        
        

       

        {/* =================================================
            SAFETY ZONE LABELS
        ================================================= */}

        <div className="palk-zone-labels">

          {(["SAFE", "CAUTION", "WARNING", "CRITICAL"] as const).map((zone) => (
            <div
              className={`zone-label ${zone.toLowerCase()}`}
              key={zone}
              aria-current={safetyZone === zone ? "true" : undefined}
            >
              <ZoneIcon zone={zone} />
              <strong>{SAFETY_ALERT_CONTENT[alertLanguage][zone].label}</strong>
            </div>
          ))}

        </div>

        {/* =================================================
            HUD
        ================================================= */}

        <div className="palk-map-hud">

          <div className="palk-hud-card">

            <span>
              VESSEL POSITION
            </span>

            <strong>
              {boatPosition[0].toFixed(4)}
              ° N
            </strong>

            <strong>
              {boatPosition[1].toFixed(4)}
              ° E
            </strong>

          </div>

          <div className="palk-hud-card">

            <span>
              BOUNDARY DISTANCE
            </span>

            <strong>
              {boundaryDistance.toFixed(1)}
              {" "}KM
            </strong>

          </div>

          <div className="palk-hud-card">

            <span>
              SAFETY STATUS
            </span>

            <strong
              className={`status-${safetyZone.toLowerCase()}`}
            >
              <ZoneIcon zone={safetyZone} />
              {zoneContent.label}
            </strong>

            {voiceStatus && (
              <small className="palk-voice-status" role="status">
                {voiceStatus}
              </small>
            )}

          </div>

        </div>

        {/* =================================================
            LEGEND
        ================================================= */}

        <div className="palk-legend">

          {(["SAFE", "CAUTION", "WARNING", "CRITICAL"] as const).map((zone) => (
            <div key={zone}>
              <span className={`zone-icon-holder ${zone.toLowerCase()}`}>
                <ZoneIcon zone={zone} />
              </span>
              {SAFETY_ALERT_CONTENT[alertLanguage][zone].label}
            </div>
          ))}

          <div>
            <i className="legend-boundary" />
            FINAL BOUNDARY
          </div>

        </div>

      </div>

      {/* =================================================
          SAFETY CARDS
      ================================================= */}

      <div className="palk-safety-grid">

        <div
          className={`palk-safety-card telemetry-card ${safetyZone.toLowerCase()}`}
          role="status"
          aria-live="polite"
        >

          <span className="telemetry-label">
            {CURRENT_ZONE_LABEL[alertLanguage]}
          </span>

          <div className={`palk-current-zone status-${safetyZone.toLowerCase()}`}>
            <ZoneIcon zone={safetyZone} />
            <strong>{zoneContent.label}</strong>
          </div>

          <p key={`${alertLanguage}-${safetyZone}`}>
            {zoneContent.message}
          </p>

        </div>

        <div className="palk-safety-card telemetry-card">

          <span className="telemetry-label">
            GPS MONITORING
          </span>

          <strong>
            ACTIVE
          </strong>

          <p>
            Vessel position is being
            continuously monitored.
          </p>

        </div>

        <div className="palk-safety-card telemetry-card">

          <span className="telemetry-label">
            LAND COLLISION
          </span>

          <strong>
            ACTIVE
          </strong>

          <p>
            Land boundaries are checked continuously; all safety zones remain reachable.
          </p>

        </div>

      </div>

    </section>
  );
}