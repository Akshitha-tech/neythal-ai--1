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
import { useEffect, useMemo, useRef, useState } from "react";

import type { SafetyZone } from "./neythalAI";

import "leaflet/dist/leaflet.css";

type Props = {
  onSafetyChange?: (zone: SafetyZone) => void;
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

/* =========================================================
   INITIAL BOAT POSITION
========================================================= */

const initialBoatPosition: [number, number] = [
  9.78,
  79.18,
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

/* =========================================================
   MAP CAMERA
========================================================= */

function MapCamera() {
  const map = useMap();

  useEffect(() => {
    map.setView([9.55, 79.35], 9.4);
  }, [map]);

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

function calculateSafetyZone(
  distance: number
): SafetyZone {
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
   POINT-IN-POLYGON
========================================================= */

function isInsideIndianZone(
  point: [number, number]
) {
  const [lat, lng] = point;

  let inside = false;

  for (
    let i = 0,
      j = indianNavigationZone.length - 1;
    i < indianNavigationZone.length;
    j = i++
  ) {
    const xi =
      indianNavigationZone[i][1];

    const yi =
      indianNavigationZone[i][0];

    const xj =
      indianNavigationZone[j][1];

    const yj =
      indianNavigationZone[j][0];

    const intersect =
      yi > lat !== yj > lat &&
      lng <
        ((xj - xi) *
          (lat - yi)) /
          (yj - yi) +
          xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/* =========================================================
   KEEP BOAT INSIDE INDIAN ZONE
========================================================= */

function clampBoatToIndianZone(
  target: [number, number]
): [number, number] {
  if (isInsideIndianZone(target)) {
    return target;
  }

  let closest =
    indianNavigationZone[0];

  let closestDistance =
    Number.POSITIVE_INFINITY;

  for (
    let i = 0;
    i < indianNavigationZone.length;
    i++
  ) {
    const point =
      indianNavigationZone[i];

    const distance =
      distanceKm(target, point);

    if (
      distance <
      closestDistance
    ) {
      closestDistance = distance;
      closest = point;
    }
  }

  return closest;
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function MaritimeMap({
  onSafetyChange,
}: Props) {
  const [
    boatPosition,
    setBoatPosition,
  ] = useState<[number, number]>(
    initialBoatPosition
  );

  const boundaryDistance =
    getNearestBoundaryDistance(boatPosition);

  const safetyZone =
    calculateSafetyZone(boundaryDistance);

  const previousSafetyZone =
    useRef<SafetyZone>(safetyZone);

  const [
    boatTrail,
    setBoatTrail,
  ] = useState<
    [number, number][]
  >([initialBoatPosition]);

  const movementIndex =
    useRef(0);

  /* =======================================================
     DEMO WAYPOINTS
  ======================================================= */

  const boatWaypoints =
    useMemo<
      [number, number][]
    >(
      () => [
        [9.78, 79.18],
        [9.82, 79.2],
        [9.86, 79.22],
        [9.89, 79.24],
        [9.91, 79.26],
        [9.88, 79.29],
        [9.84, 79.31],
        [9.8, 79.3],
        [9.76, 79.27],
        [9.73, 79.24],
        [9.76, 79.21],
      ],
      []
    );

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
    const interval =
      setInterval(() => {
        movementIndex.current =
          (movementIndex.current + 1) %
          boatWaypoints.length;

        const target =
          boatWaypoints[
            movementIndex.current
          ];

        const safeTarget =
          clampBoatToIndianZone(
            target
          );

        setBoatPosition(
          safeTarget
        );

        setBoatTrail(
          previous => {
            const updated = [
              ...previous,
              safeTarget,
            ];

            return updated.slice(-12);
          }
        );
      }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [boatWaypoints]);

  /* =======================================================
     DRAG BOAT
  ======================================================= */

  const handleBoatDrag = (
    event: L.DragEndEvent
  ) => {
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

    const safePosition =
      clampBoatToIndianZone(
        requestedPosition
      );

    setBoatPosition(
      safePosition
    );

    setBoatTrail(
      previous => [
        ...previous.slice(-11),
        safePosition,
      ]
    );

    marker.setLatLng(
      safePosition
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

        <div
          className={`palk-live-status ${safetyZone.toLowerCase()}`}
        >
          <span />
          {safetyZone}
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

          <MapCamera />

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
            position={boatPosition}
            icon={boatIcon}
            draggable={true}
            eventHandlers={{
              dragend:
                handleBoatDrag,
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

              {safetyZone}

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

          <div className="zone-label safe">
            <span />
            SAFE
          </div>

          <div className="zone-label caution">
            <span />
            CAUTION
          </div>

          <div className="zone-label warning">
            <span />
            WARNING
          </div>

          <div className="zone-label critical">
            <span />
            CRITICAL
          </div>

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
              ● {safetyZone}
            </strong>

          </div>

        </div>

        {/* =================================================
            LEGEND
        ================================================= */}

        <div className="palk-legend">

          <div>
            <i className="legend-safe" />
            SAFE
          </div>

          <div>
            <i className="legend-caution" />
            CAUTION
          </div>

          <div>
            <i className="legend-warning" />
            WARNING
          </div>

          <div>
            <i className="legend-critical" />
            CRITICAL
          </div>

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
          className={`palk-safety-card ${safetyZone.toLowerCase()}`}
        >

          <span>
            CURRENT SAFETY STATUS
          </span>

          <strong>
            {safetyZone}
          </strong>

          <p>

            {safetyZone === "SAFE" &&
              "Unga vessel Indian navigation zone-kulla safe-aa irukku."}

            {safetyZone === "CAUTION" &&
              "Boundary pakkathula vandhutteenga. Careful-aa continue pannunga."}

            {safetyZone === "WARNING" &&
              "Boundary-ku close-aa irukeenga. Safe side-ku thirumbi ponga."}

            {safetyZone === "CRITICAL" &&
              "Echarikkai! Boundary-ku romba close-aa irukeenga. Udane safe side-ku thirumbunga."}

          </p>

        </div>

        <div className="palk-safety-card">

          <span>
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

        <div className="palk-safety-card">

          <span>
            GEOFENCE
          </span>

          <strong>
            LOCKED
          </strong>

          <p>
            Vessel movement is restricted
            to the Indian-side navigation zone.
          </p>

        </div>

      </div>

    </section>
  );
}