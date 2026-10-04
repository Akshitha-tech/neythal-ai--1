import MaritimeMap from "./MaritimeMap";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

import { getSafetyResponse, type SafetyZone } from "./neythalAI";
import NeythalChatbot from "./components/NeythalChatbot";

/* =========================================================
   OCEAN
========================================================= */

function Ocean() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime();
    const position = meshRef.current.geometry.attributes.position;

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);

      const wave =
        Math.sin(x * 0.75 + time * 1.1) * 0.12 +
        Math.cos(y * 0.65 + time * 0.9) * 0.08 +
        Math.sin((x + y) * 0.35 + time) * 0.04;

      position.setZ(i, wave);
    }

    position.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
      <planeGeometry args={[35, 35, 100, 100]} />

      <meshStandardMaterial color="#063746" metalness={0.75} roughness={0.22} />
    </mesh>
  );
}

/* =========================================================
   BOAT WAKE
========================================================= */

function BoatWake() {
  const wakeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!wakeRef.current) return;

    const t = clock.getElapsedTime();

    wakeRef.current.scale.x = 1 + Math.sin(t * 2) * 0.08;

    wakeRef.current.scale.z = 1 + Math.sin(t * 1.7) * 0.06;
  });

  return (
    <group
      ref={wakeRef}
      position={[0, -0.91, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <mesh position={[-0.6, 0, 0]}>
        <circleGeometry args={[0.7, 32]} />

        <meshBasicMaterial color="#43d9dd" transparent opacity={0.13} />
      </mesh>

      <mesh position={[-1.2, 0, 0]}>
        <circleGeometry args={[0.45, 32]} />

        <meshBasicMaterial color="#8ffcff" transparent opacity={0.08} />
      </mesh>

      <mesh position={[-1.8, 0, 0]}>
        <circleGeometry args={[0.25, 32]} />

        <meshBasicMaterial color="#8ffcff" transparent opacity={0.05} />
      </mesh>
    </group>
  );
}

/* =========================================================
   REALISTIC FISHING BOAT
========================================================= */

function Boat() {
  const boatRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!boatRef.current) return;

    const t = clock.getElapsedTime();

    boatRef.current.position.y = Math.sin(t * 1.15) * 0.055;

    boatRef.current.rotation.z = Math.sin(t * 0.75) * 0.018;

    boatRef.current.rotation.x = Math.sin(t * 0.55) * 0.012;
  });

  return (
    <group
      ref={boatRef}
      position={[1.3, -0.05, 0]}
      rotation={[0, 0.25, 0]}
      scale={1.05}
    >
      <mesh position={[0, 0, 0]} scale={[2.35, 0.48, 0.85]}>
        <sphereGeometry args={[1, 32, 20]} />

        <meshStandardMaterial
          color="#102e38"
          metalness={0.65}
          roughness={0.25}
        />
      </mesh>

      <mesh position={[0, 0.18, 0]} scale={[2.25, 0.23, 0.86]}>
        <sphereGeometry args={[1, 32, 20]} />

        <meshStandardMaterial color="#d9eeee" metalness={0.3} roughness={0.3} />
      </mesh>

      <mesh position={[0, -0.25, 0]} scale={[1.9, 0.22, 0.72]}>
        <sphereGeometry args={[1, 32, 16]} />

        <meshStandardMaterial
          color="#06151b"
          metalness={0.75}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[1.75, 0.08, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.72, 1.45, 5]} />

        <meshStandardMaterial color="#d9eeee" metalness={0.3} roughness={0.3} />
      </mesh>

      <mesh position={[-0.1, 0.48, 0]} scale={[1.55, 0.08, 0.7]}>
        <boxGeometry args={[1, 1, 1]} />

        <meshStandardMaterial
          color="#173e48"
          metalness={0.45}
          roughness={0.38}
        />
      </mesh>

      <mesh position={[-0.45, 0.83, 0]} scale={[0.82, 0.55, 0.62]}>
        <boxGeometry args={[1, 1, 1]} />

        <meshStandardMaterial
          color="#dff6f6"
          metalness={0.25}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0.0, 0.88, -0.635]}>
        <boxGeometry args={[0.58, 0.3, 0.025]} />

        <meshStandardMaterial
          color="#061c25"
          metalness={0.8}
          roughness={0.12}
          emissive="#087c91"
          emissiveIntensity={0.35}
        />
      </mesh>

      <mesh position={[-0.47, 0.9, 0.635]}>
        <boxGeometry args={[0.55, 0.3, 0.025]} />

        <meshStandardMaterial
          color="#061c25"
          metalness={0.8}
          roughness={0.12}
          emissive="#087c91"
          emissiveIntensity={0.35}
        />
      </mesh>

      <mesh position={[-0.47, 0.9, -0.635]}>
        <boxGeometry args={[0.55, 0.3, 0.025]} />

        <meshStandardMaterial
          color="#061c25"
          metalness={0.8}
          roughness={0.12}
          emissive="#087c91"
          emissiveIntensity={0.35}
        />
      </mesh>

      <mesh position={[-0.45, 1.15, 0]} scale={[0.94, 0.09, 0.7]}>
        <boxGeometry args={[1, 1, 1]} />

        <meshStandardMaterial
          color="#efffff"
          metalness={0.2}
          roughness={0.28}
        />
      </mesh>

      <mesh position={[-0.45, 1.75, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 1.25, 16]} />

        <meshStandardMaterial
          color="#a9c9cc"
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[-0.45, 2.48, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.45, 12]} />

        <meshStandardMaterial
          color="#e5ffff"
          metalness={0.8}
          roughness={0.15}
        />
      </mesh>

      <mesh position={[-0.45, 2.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.08, 0.045, 32]} />

        <meshStandardMaterial
          color="#58777c"
          metalness={0.75}
          roughness={0.25}
        />
      </mesh>

      <mesh position={[-0.25, 2.25, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.45, 0.025, 0.025]} />

        <meshStandardMaterial color="#a8d1d3" metalness={0.8} />
      </mesh>

      <mesh position={[1.55, 0.55, 0]}>
        <sphereGeometry args={[0.065, 20, 20]} />

        <meshStandardMaterial
          color="#ffffff"
          emissive="#43d9dd"
          emissiveIntensity={5}
        />
      </mesh>

      <pointLight
        position={[1.55, 0.55, 0]}
        color="#43d9dd"
        intensity={2}
        distance={3}
      />

      <mesh position={[-0.45, 1.25, 0]}>
        <sphereGeometry args={[0.045, 16, 16]} />

        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={4}
        />
      </mesh>

      <mesh position={[-1.5, 0.57, 0]} scale={[0.38, 0.38, 0.45]}>
        <boxGeometry args={[1, 1, 1]} />

        <meshStandardMaterial
          color="#102b32"
          metalness={0.65}
          roughness={0.3}
        />
      </mesh>

      <mesh position={[0.75, 0.67, 0.62]}>
        <cylinderGeometry args={[0.018, 0.018, 0.4, 8]} />

        <meshStandardMaterial color="#bdd7d9" metalness={0.85} />
      </mesh>

      <mesh position={[1.25, 0.67, 0.62]}>
        <cylinderGeometry args={[0.018, 0.018, 0.4, 8]} />

        <meshStandardMaterial color="#bdd7d9" metalness={0.85} />
      </mesh>

      <mesh position={[1, 0.85, 0.62]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.55, 8]} />

        <meshStandardMaterial color="#bdd7d9" metalness={0.85} />
      </mesh>

      <pointLight
        position={[0, -0.65, 0]}
        color="#00d9ff"
        intensity={2.5}
        distance={4}
      />
    </group>
  );
}

/* =========================================================
   MARITIME THREAT ZONE
========================================================= */

function ThreatZone() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;

    const t = clock.getElapsedTime();

    ringRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.05);

    ringRef.current.rotation.z = t * 0.15;
  });

  return (
    <group position={[3.5, -0.75, -1]}>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.25, 0.035, 16, 80]} />

        <meshStandardMaterial
          color="#ff786d"
          emissive="#ff3d32"
          emissiveIntensity={2}
        />
      </mesh>

      <pointLight
        position={[0, 0, 0]}
        color="#ff786d"
        intensity={2}
        distance={4}
      />
    </group>
  );
}

/* =========================================================
   MAIN 3D SCENE
========================================================= */

function Scene() {
  const { pointer } = useThree();

  const cameraTarget = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    const scroll = window.scrollY / Math.max(window.innerHeight, 1);

    const progress = THREE.MathUtils.clamp(scroll, 0, 1);

    const targetX = THREE.MathUtils.lerp(0, 1.2, progress);

    const targetY = THREE.MathUtils.lerp(4.5, 3.5, progress);

    const targetZ = THREE.MathUtils.lerp(7, 6, progress);

    const mouseX = pointer.x * 0.35;
    const mouseY = pointer.y * 0.2;

    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      targetX + mouseX,
      0.035,
    );

    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      targetY + mouseY,
      0.035,
    );

    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.035);

    cameraTarget.current.set(pointer.x * 0.2, -0.25 + pointer.y * 0.1, 0);

    camera.lookAt(cameraTarget.current);
  });

  return (
    <>
      <ambientLight intensity={0.45} />

      <directionalLight position={[5, 8, 5]} intensity={1.8} color="#b8f5ff" />

      <pointLight
        position={[0, 3, 1]}
        intensity={3}
        distance={12}
        color="#087c91"
      />

      <Stars
        radius={80}
        depth={45}
        count={2200}
        factor={3}
        saturation={0}
        fade
        speed={0.35}
      />

      <Ocean />

      <BoatWake />

      <Boat />

      <ThreatZone />
    </>
  );
}

/* =========================================================
   WEBSITE
========================================================= */
/* =========================================================
   GLOBAL HEADER
========================================================= */

function GlobalHeader({
  safetyZone,
  isConnected,
  setIsConnected,
  setChatOpen,
}: {
  safetyZone: SafetyZone;
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  setChatOpen: (value: boolean) => void;
}) {
  const [sosOpen, setSosOpen] = useState(false);

  const navigation = [
    { label: "HOME", id: "home" },
    { label: "SAFETY", id: "safety" },
    { label: "OCEAN", id: "ocean" },
    { label: "FISHING", id: "fishing" },
    { label: "LIVE MAP", id: "live-map" },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const getRiskLabel = () => {
    switch (safetyZone) {
      case "CAUTION":
        return "RISK: CAUTION";
      case "WARNING":
        return "RISK: WARNING";
      case "CRITICAL":
        return "RISK: CRITICAL";
      default:
        return "RISK: SAFE";
    }
  };

  return (
    <>
      <header className="neythal-global-header">
        {/* BRAND */}
        <div
          className="neythal-header-brand"
          onClick={() => scrollToSection("home")}
        >
          <div className="neythal-header-logo">
            <span>N</span>
          </div>

          <div className="neythal-header-brand-text">
            <div className="neythal-header-name">
              NEYTHAL <span>AI</span>
            </div>

            <div className="neythal-header-subtitle">
              MARITIME SAFETY SYSTEM
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="neythal-global-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className="neythal-nav-item"
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* RIGHT SIDE */}
        <div className="neythal-header-actions">
          {/* RISK */}
          <div
            className={`neythal-risk-indicator risk-${safetyZone.toLowerCase()}`}
          >
            <span className="risk-dot" />
            <span>{getRiskLabel()}</span>
          </div>

          {/* GPS */}
          <div className="neythal-gps-status">
            <span className="gps-pulse" />
            <span className="gps-label">GPS</span>
            <strong>{isConnected ? "ACTIVE" : "OFFLINE"}</strong>
          </div>

          {/* CONNECTION */}
          <button
            className={`neythal-connection ${
              isConnected ? "connected" : "disconnected"
            }`}
            onClick={() => setIsConnected(!isConnected)}
          >
            <span className="connection-icon">{isConnected ? "◉" : "○"}</span>

            {isConnected ? "CONNECTED" : "OFFLINE"}
          </button>

          {/* NEYTHAL AI */}
          <button
            className="neythal-ai-header-button"
            onClick={() => setChatOpen(true)}
          >
            <span className="neythal-ai-orb">N</span>
            <span>NEYTHAL AI</span>
          </button>

          {/* OFFLINE SOS */}
          <button
            className="neythal-sos-button"
            onClick={() => setSosOpen(true)}
          >
            <span className="sos-symbol">⚠</span>
            <span>SOS</span>
          </button>
        </div>
      </header>

      {/* SOS WINDOW */}
      {sosOpen && (
        <div className="neythal-sos-overlay">
          <div className="neythal-sos-panel">
            <button
              className="neythal-sos-close"
              onClick={() => setSosOpen(false)}
            >
              ×
            </button>

            <div className="neythal-sos-icon">⚠</div>

            <div className="neythal-sos-eyebrow">NEYTHAL // EMERGENCY MODE</div>

            <h2>OFFLINE SOS</h2>

            <p>
              Emergency mode remains available when network connectivity is
              unavailable.
            </p>

            <div className="neythal-sos-status">
              <div>
                <span>GPS STATUS</span>

                <strong>{isConnected ? "ACTIVE" : "LAST KNOWN"}</strong>
              </div>

              <div>
                <span>NETWORK</span>

                <strong>{isConnected ? "CONNECTED" : "OFFLINE"}</strong>
              </div>
            </div>

            <button
              className="neythal-emergency-button"
              onClick={() => {
                alert("NEYTHAL EMERGENCY MODE ACTIVATED");
              }}
            >
              ACTIVATE EMERGENCY MODE
            </button>

            <div className="neythal-sos-note">
              Emergency actions will use the vessel's latest available position.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [showSOS, setShowSOS] = useState(false);
  const [safetyZone, setSafetyZone] = useState<SafetyZone>("SAFE");

  const [chatOpen, setChatOpen] = useState(false);

  const [isConnected, setIsConnected] = useState(true);

  const speakNeythal = (text: string) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "ta-IN";
    speech.rate = 0.92;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
  };

  const handleSafetyChange = (zone: SafetyZone) => {
    setSafetyZone(zone);

    const response = getSafetyResponse(zone);

    /*
      Speak Tamil warning
    */
    if (zone !== "SAFE") {
      speakNeythal(response.tamil);
    }
  };

  return (
    <main className="neythal-site">
      {/* =====================================================
    GLOBAL NEYTHAL HEADER
===================================================== */}

      <GlobalHeader
        safetyZone={safetyZone}
        isConnected={isConnected}
        setIsConnected={setIsConnected}
        setChatOpen={setChatOpen}
      />

      {/* =====================================================
          SECTION 01 — HERO
      ===================================================== */}

      <section id="home" className="hero-section">
        <div className="hero-overlay">
          <div className="brand">NEYTHAL</div>

          <div className="hero-content">
            <p className="eyebrow">AI MARITIME INTELLIGENCE</p>

            <h1>
              THE SEA
              <br />
              NEVER
              <br />
              STOPS.
            </h1>

            <p className="hero-description">
              AI-powered maritime safety and fishing intelligence designed for
              the people who live by the sea.
            </p>

            <button
              className="explore-button"
              onClick={() => {
                document.getElementById("safety")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
            >
              EXPLORE NEYTHAL
              <span>→</span>
            </button>
          </div>

          <div className="status">
            <span className="status-dot" />
            SYSTEM ONLINE
          </div>

          <div className="bottom-label">MARITIME INTELLIGENCE / 01</div>
        </div>

        <Canvas
          camera={{
            position: [0, 4.5, 7],
            fov: 50,
          }}
        >
          <Scene />
        </Canvas>
      </section>

      {/* =====================================================
          SECTION 02 — MARITIME THREAT
      ===================================================== */}

      <section id="safety" className="threat-section">
        <div className="threat-content">
          <p className="section-number">02 / MARITIME THREAT</p>

          <h2>
            THE SEA
            <br />
            CAN CHANGE
            <br />
            IN MINUTES.
          </h2>

          <p className="threat-description">
            Ocean conditions can shift rapidly. Strong winds, rough seas and
            maritime hazards can turn a safe journey into a dangerous one.
          </p>

          <div className="threat-status">
            <div className="threat-indicator">
              <span />
              LIVE OCEAN MONITORING
            </div>

            <div className="threat-indicator">
              <span />
              HAZARD DETECTION ACTIVE
            </div>
          </div>
        </div>

        <div className="threat-visual">
          <div className="radar-ring radar-one" />

          <div className="radar-ring radar-two" />

          <div className="radar-ring radar-three" />

          <button
            className="danger-core"
            onClick={() => setShowSOS(true)}
            aria-label="Open SOS dashboard"
          >
            !
          </button>

          <div className="danger-label">
            <span>DANGER ZONE</span>
            <small>DETECTED AHEAD</small>
          </div>
        </div>
      </section>

      {/* =====================================================
          SECTION 03 — OCEAN INTELLIGENCE
      ===================================================== */}

      <section id="ocean" className="intelligence-section">
        <div className="intelligence-header">
          <p className="section-number">03 / OCEAN INTELLIGENCE</p>

          <h2>
            READ
            <br />
            THE OCEAN.
          </h2>

          <p className="intelligence-description">
            Neythal continuously interprets ocean conditions to understand what
            is happening beneath and around the vessel.
          </p>
        </div>

        <div className="ocean-data-visual">
          <div className="ocean-grid" />

          <div className="wave-line wave-line-one" />

          <div className="wave-line wave-line-two" />

          <div className="wave-line wave-line-three" />

          <div className="data-point point-one">
            <span />
          </div>

          <div className="data-point point-two">
            <span />
          </div>

          <div className="data-point point-three">
            <span />
          </div>

          <div className="ocean-center">
            <div className="center-ring" />

            <div className="center-core">
              <span>LIVE</span>
              OCEAN
            </div>
          </div>
        </div>

        <div className="telemetry-grid">
          <div className="telemetry-card">
            <span className="telemetry-label">SEA STATE</span>

            <strong>MODERATE</strong>

            <span className="telemetry-status">STABLE</span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-label">WIND</span>

            <strong>
              18.4
              <small> KM/H</small>
            </strong>

            <span className="telemetry-status">↗ SOUTHWEST</span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-label">WAVE HEIGHT</span>

            <strong>
              1.8
              <small> M</small>
            </strong>

            <span className="telemetry-status">NORMAL</span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-label">WATER TEMP</span>

            <strong>
              28.6
              <small> °C</small>
            </strong>

            <span className="telemetry-status">OPTIMAL</span>
          </div>
        </div>

        <div className="telemetry-footer">
          <span>● LIVE TELEMETRY</span>

          <span>BAY OF BENGAL</span>

          <span>DATA STREAM / ACTIVE</span>
        </div>
      </section>

      {/* =====================================================
          SECTION 04 — MARITIME SAFETY
      ===================================================== */}

      <section id="maritime-safety" className="safety-section">
        <div className="safety-header">
          <p className="section-number">04 / MARITIME SAFETY</p>

          <h2>
            KNOW
            <br />
            THE DANGER.
          </h2>

          <p className="safety-description">
            Neythal continuously monitors the vessel's surroundings, maritime
            boundaries and changing sea conditions to identify potential threats
            before they become critical.
          </p>
        </div>

        {/* RADAR */}

        <div className="radar-system">
          <div className="radar-grid" />

          <div className="radar-ring radar-ring-one" />
          <div className="radar-ring radar-ring-two" />
          <div className="radar-ring radar-ring-three" />
          <div className="radar-ring radar-ring-four" />

          <div className="radar-cross horizontal" />
          <div className="radar-cross vertical" />

          <div className="radar-sweep" />

          <div className="radar-vessel">
            <span />
          </div>

          <div className="radar-threat threat-a">
            <span />
          </div>

          <div className="radar-threat threat-b">
            <span />
          </div>

          <div className="radar-threat threat-c">
            <span />
          </div>

          <div className="radar-label label-vessel">VESSEL</div>

          <div className="radar-label label-threat-a">RESTRICTED</div>

          <div className="radar-label label-threat-b">HIGH RISK</div>

          <div className="radar-center">
            <span>YOU</span>
          </div>
        </div>

        {/* SAFETY CARDS */}

        <div className="safety-cards">
          <div className="safety-card">
            <span className="safety-card-index">01</span>

            <span className="safety-card-label">MARITIME BOUNDARY</span>

            <strong>SAFE</strong>

            <p>Vessel remains within the permitted navigation zone.</p>
          </div>

          <div className="safety-card warning">
            <span className="safety-card-index">02</span>

            <span className="safety-card-label">THREAT DETECTION</span>

            <strong>02 ALERTS</strong>

            <p>Potential restricted areas detected ahead.</p>
          </div>

          <div className="safety-card">
            <span className="safety-card-index">03</span>

            <span className="safety-card-label">AI RESPONSE</span>

            <strong>ACTIVE</strong>

            <p>Neythal is continuously evaluating the safest route.</p>
          </div>
        </div>

        <div className="safety-footer">
          <span>● SAFETY MONITORING ACTIVE</span>

          <span>RADAR / ONLINE</span>

          <span>THREAT ANALYSIS / LIVE</span>
        </div>
      </section>

      {/* =====================================================
          SECTION 05 — FISHING INTELLIGENCE
      ===================================================== */}

      <section id="fishing" className="fishing-section">
        {/* HEADER */}

        <div className="fishing-header">
          <div>
            <p className="section-number">05 / FISHING INTELLIGENCE</p>

            <h2>
              FIND
              <br />
              THE RIGHT
              <br />
              WATERS.
            </h2>

            <p className="fishing-description">
              AI-analyzed ocean biological parameters for Tamil deep-sea
              fishermen.
            </p>
          </div>

          <div className="regional-model">
            <span>✧</span>
            Regional Model: Gulf of Mannar
          </div>
        </div>

        {/* MAIN INTELLIGENCE */}

        <div className="fishing-intelligence-grid">
          {/* SCORE */}

          <div className="fishing-score-card">
            <span className="fishing-card-title">
              FISHING SUITABILITY SCORE
            </span>

            <div className="score-circle">
              <div className="score-inner">
                <strong>88</strong>

                <span>/100</span>
              </div>
            </div>

            <div className="classification">CLASSIFICATION: HIGH</div>

            <div className="classification-tamil">உயர்ந்த மீன்பிடி திறன்</div>
          </div>

          {/* AI ADVISORY */}

          <div className="marine-advisory">
            <div className="advisory-title">↗ AI MARINE ADVISORY</div>

            <div className="advisory-message">
              "இந்த பகுதியில் மீன்பிடிக்க மிகவும் ஏற்ற சூழ்நிலை உள்ளது."
            </div>

            <p>
              Optimal sea surface temperature and gentle swell creating high
              fishing potential.
            </p>

            <div className="advisory-divider" />

            <div className="advisory-info">
              <span className="info-icon">ⓘ</span>

              <p>
                Calculated using localized sea-surface temperature, wave
                turbulence, and coastal wind gradients. Target species:{" "}
                <em>
                  Sardinella longiceps, Scomberomorus commerson, and Snapper.
                </em>
              </p>
            </div>
          </div>
        </div>

        {/* ENVIRONMENTAL FACTOR MATRIX */}

        <div className="factor-heading">ENVIRONMENTAL FACTOR MATRIX</div>

        <div className="factor-grid">
          {/* SEA TEMPERATURE */}

          <div className="factor-card">
            <div className="factor-top">
              <strong>Sea Surface Temp</strong>

              <span>28.4°C</span>
            </div>

            <div className="factor-bar">
              <div className="factor-fill temperature" />
            </div>

            <p>
              Optimal sea temperature for Sardine, Mackerel & Tuna aggregation.
            </p>
          </div>

          {/* WAVE HEIGHT */}

          <div className="factor-card">
            <div className="factor-top">
              <strong>Wave Height</strong>

              <span>1.8 m</span>
            </div>

            <div className="factor-bar">
              <div className="factor-fill waves" />
            </div>

            <p>Moderate swell. Manageable with standard motorized trawlers.</p>
          </div>

          {/* WIND */}

          <div className="factor-card">
            <div className="factor-top">
              <strong>Wind Speed</strong>

              <span>18 km/h (NE)</span>
            </div>

            <div className="factor-bar">
              <div className="factor-fill wind" />
            </div>

            <p>
              Gentle wind conditions favorable for longline & gillnet fishing.
            </p>
          </div>
        </div>

        {/* DISCLAIMER */}

        <div className="fishing-disclaimer">
          * Prototype fishing suitability index. Real-world fishing decisions
          should consider local fisheries department directives and ocean
          weather advisories.
        </div>

        {/* AI FISHING ZONES */}

        <div className="fishing-map">
          <div className="map-grid" />

          <div className="map-label map-title">AI FISHING ZONES</div>

          <div className="map-label map-location">GULF OF MANNAR</div>

          <div className="fishing-zone zone-high">
            <span>HIGH</span>
          </div>

          <div className="fishing-zone zone-medium">
            <span>MODERATE</span>
          </div>

          <div className="fishing-zone zone-low">
            <span>LOW</span>
          </div>

          <div className="boat-marker">⌁</div>

          <div className="route-line" />
        </div>

        {/* FOOTER */}

        <div className="fishing-footer">
          <span>● FISHING INTELLIGENCE ACTIVE</span>

          <span>AI MODEL / ONLINE</span>

          <span>TAMIL NADU DEEP-SEA FISHERIES</span>
        </div>
      </section>

      {/* =====================================================
          SECTION 06 — FUNCTIONAL MARITIME MAP
      ===================================================== */}

      <section id="live-map" className="maritime-map-section">
        <MaritimeMap onSafetyChange={handleSafetyChange} />
      </section>

      <NeythalChatbot
        safetyZone={safetyZone}
        open={chatOpen}
        setOpen={setChatOpen}
      />
      {showSOS && (
  <div
    className="sos-overlay"
    onClick={() => setShowSOS(false)}
  >
    <div
      className="sos-dashboard"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        className="sos-close"
        onClick={() => setShowSOS(false)}
      >
        ×
      </button>

      <div className="sos-header">
        <div className="sos-warning-icon">
          !
        </div>

        <div>
          <span>SOS / EMERGENCY SYSTEM</span>
          <h2>DANGER DETECTED</h2>
        </div>
      </div>

      <div className="sos-status">
        <span className="sos-status-dot" />
        IMMEDIATE ATTENTION REQUIRED
      </div>

      <div className="sos-grid">

        <div className="sos-card">
          <span>THREAT STATUS</span>
          <strong>DANGER ZONE</strong>
        </div>

        <div className="sos-card">
          <span>VESSEL STATUS</span>
          <strong>AT RISK</strong>
        </div>

        <div className="sos-card">
          <span>GPS MONITORING</span>
          <strong>ACTIVE</strong>
        </div>

        <div className="sos-card">
          <span>EMERGENCY LINK</span>
          <strong>READY</strong>
        </div>

      </div>

      <div className="sos-message">
        <strong>
          ⚠ DANGER ZONE DETECTED AHEAD
        </strong>

        <p>
          Your vessel is approaching a detected maritime
          danger area. Review the vessel position and take
          appropriate safety action.
        </p>
      </div>

      <button
        className="sos-action-button"
        onClick={() => setShowSOS(false)}
      >
        ACKNOWLEDGE ALERT
      </button>
    </div>
  </div>
)}
    </main>
  );
}
