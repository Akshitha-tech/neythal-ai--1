import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import VoiceAssistant from "./VoiceAssistant";
import FishingMap from "./FishingMap";
import { fishingCopy, type FishingCopy, type FishingLanguage } from "../../i18n/fishing";
import { HybridFishingDataProvider } from "../../services/fishing/HybridFishingDataProvider";
import type {
  FishingDataResult,
  FishingZone,
  OceanCondition,
} from "../../services/fishing/types";
import { calculateFishingIntelligence } from "../../utils/fishing/calculateFishingRisk";
import { getActivitySnapshot } from "../../utils/fishing/getActivitySnapshot";
import {
  advanceMarineSimulationState,
  createMarineSimulationState,
  type MarineSimulationState,
} from "../../utils/fishing/marineSimulation";

function nearestCondition(
  zone: FishingZone,
  conditions: OceanCondition[]
): OceanCondition | undefined {
  return conditions.reduce<OceanCondition | undefined>((nearest, condition) => {
    if (!nearest) return condition;
    const distance = Math.hypot(
      condition.latitude - zone.center.latitude,
      condition.longitude - zone.center.longitude
    );
    const nearestDistance = Math.hypot(
      nearest.latitude - zone.center.latitude,
      nearest.longitude - zone.center.longitude
    );
    return distance < nearestDistance ? condition : nearest;
  }, undefined);
}

function metric(value: number | undefined, unit: string, digits = 1): string {
  return value === undefined ? "—" : `${value.toFixed(digits)} ${unit}`;
}

const DEFAULT_TARGET_SPECIES = ["Tuna", "Mackerel", "Sardine"];

function createRefreshRandom(seedValue: string) {
  let seed = 2166136261;
  for (let index = 0; index < seedValue.length; index++) {
    seed = Math.imul(seed ^ seedValue.charCodeAt(index), 16777619);
  }
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function suitabilityBand(score: number, copy: FishingCopy): {
  key: keyof FishingCopy["marineStatuses"];
  label: string;
} {
  if (score >= 90) return { key: "excellent", label: copy.suitabilityBands.excellent };
  if (score >= 75) return { key: "good", label: copy.suitabilityBands.good };
  if (score >= 60) return { key: "moderate", label: copy.suitabilityBands.moderate };
  if (score >= 40) return { key: "low", label: copy.suitabilityBands.low };
  return { key: "critical", label: copy.suitabilityBands.critical };
}

type ConditionMetricKey =
  | "temperature"
  | "waves"
  | "turbulence"
  | "wind"
  | "direction"
  | "gradient"
  | "current"
  | "chlorophyll"
  | "productivity";
type ConditionStatus = keyof FishingCopy["conditionLabels"];

function conditionStatus(
  metricKey: ConditionMetricKey,
  simulation: MarineSimulationState
): ConditionStatus {
  switch (metricKey) {
    case "temperature":
      return simulation.seaSurfaceTemperature >= 27.5 && simulation.seaSurfaceTemperature <= 29.5
        ? "optimal"
        : "favorable";
    case "waves":
      return simulation.waveHeight <= 1
        ? "favorable"
        : simulation.waveHeight <= 1.5
          ? "moderate"
          : simulation.waveHeight <= 2
            ? "caution"
            : "high";
    case "turbulence":
      return simulation.waveTurbulence < 30
        ? "favorable"
        : simulation.waveTurbulence < 42
          ? "moderate"
          : simulation.waveTurbulence < 55
            ? "caution"
            : "high";
    case "wind":
      return simulation.windSpeed <= 12
        ? "favorable"
        : simulation.windSpeed <= 17
          ? "moderate"
          : simulation.windSpeed <= 22
            ? "caution"
            : "high";
    case "direction":
      return simulation.metricScores.windDirection >= 75
        ? "favorable"
        : simulation.metricScores.windDirection >= 50
          ? "moderate"
          : "caution";
    case "gradient":
      return simulation.windGradient <= 7
        ? "favorable"
        : simulation.windGradient <= 10
          ? "moderate"
          : simulation.windGradient <= 14
            ? "caution"
            : "high";
    case "current":
      return simulation.oceanCurrent >= 0.4 && simulation.oceanCurrent <= 0.8
        ? "favorable"
        : simulation.oceanCurrent <= 0.95
          ? "moderate"
          : "caution";
    case "chlorophyll":
    case "productivity":
      return simulation.chlorophyll >= 0.65 && simulation.chlorophyll <= 0.9
        ? "optimal"
        : simulation.chlorophyll >= 0.4 && simulation.chlorophyll <= 1.1
          ? "favorable"
          : "moderate";
  }
}

function recommendedAction(
  simulation: MarineSimulationState
): keyof FishingCopy["recommendations"] {
  if (
    simulation.fishingSuitability < 40 ||
    simulation.windSpeed >= 23 ||
    simulation.waveHeight >= 2.2
  ) return "delay";
  if (
    simulation.fishingSuitability < 60 ||
    simulation.windSpeed >= 20 ||
    simulation.waveHeight >= 1.8
  ) return "reduce";
  if (
    simulation.fishingSuitability < 75 ||
    simulation.windSpeed >= 17 ||
    simulation.waveHeight >= 1.5
  ) return "caution";
  return "normal";
}

function speciesLikelihood(
  species: string,
  simulation: MarineSimulationState
): keyof FishingCopy["likelihood"] {
  if (species === "Tuna" || species === "Seer Fish") {
    return simulation.chlorophyll >= 0.75 && simulation.oceanCurrent >= 0.5
      ? "high"
      : "medium";
  }
  if (species === "Mackerel") {
    return simulation.waveHeight <= 1.8 && simulation.windSpeed <= 19
      ? "high"
      : "medium";
  }
  return simulation.chlorophyll >= 0.75 && simulation.waveHeight <= 1.5
    ? "high"
    : "medium";
}

function MarineIntelligencePanel({
  result,
  language,
  onLanguageChange,
}: {
  result: FishingDataResult;
  language: FishingLanguage;
  onLanguageChange: (language: FishingLanguage) => void;
}) {
  const zone = result.dataset.zones.find(
    (candidate) => candidate.zoneType === "FISHING"
  );

  if (!zone) {
    return <p className="marine-intelligence-error">{fishingCopy[language].unavailable}</p>;
  }

  return (
    <MarineIntelligenceDashboard
      key={`${result.source}:${result.dataset.metadata.timestamp}:${zone.id}`}
      result={result}
      zone={zone}
      language={language}
      onLanguageChange={onLanguageChange}
    />
  );
}

function MarineIntelligenceDashboard({
  result,
  zone,
  language,
  onLanguageChange,
}: {
  result: FishingDataResult;
  zone: FishingZone;
  language: FishingLanguage;
  onLanguageChange: (language: FishingLanguage) => void;
}) {
  const copy = fishingCopy[language];
  const locale = `${language}-IN`;
  const snapshot = getActivitySnapshot(
    zone.id,
    result.dataset.activityHistory,
    0,
    result.dataset.metadata.timestamp
  );
  const condition = nearestCondition(zone, result.dataset.oceanConditions);
  const intelligence = useMemo(
    () => calculateFishingIntelligence(
      zone,
      result.dataset.vessels,
      result.dataset.oceanConditions,
      snapshot
    ),
    [result.dataset.oceanConditions, result.dataset.vessels, snapshot, zone]
  );
  const windSpeeds = result.dataset.oceanConditions
    .map((reading) => reading.windSpeed)
    .filter((speed): speed is number => speed !== undefined);
  const windGradient = windSpeeds.length > 1
    ? Math.max(...windSpeeds) - Math.min(...windSpeeds)
    : windSpeeds[0] ?? 6;
  const isSimulated =
    result.source === "SIMULATED" ||
    result.dataset.metadata.providerName === "Deterministic demo dataset";
  const speciesSeed = zone.species ?? DEFAULT_TARGET_SPECIES;
  const simulationSeed = useMemo(
    () => ({
      condition,
      windGradient,
      vesselActivity: intelligence.vesselActivity,
      historicalActivity: intelligence.historicalActivity,
      vesselDensity: intelligence.vesselDensity,
      confidence: intelligence.confidence,
      species: speciesSeed,
      timestamp: Date.parse(result.dataset.metadata.timestamp) || 0,
    }),
    [condition, intelligence, result.dataset.metadata.timestamp, speciesSeed, windGradient]
  );
  const [simulation, setSimulation] = useState<MarineSimulationState>(() =>
    createMarineSimulationState(simulationSeed)
  );
  const randomRef = useRef(
    createRefreshRandom(`${zone.id}:${result.dataset.metadata.timestamp}`)
  );
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isSimulated) return;
    const random = randomRef.current;
    const initializeTimer = window.setTimeout(() => {
      setSimulation((current) => ({ ...current, updatedAt: Date.now() }));
    }, 0);
    const refreshTimer = window.setInterval(() => {
      setSimulation((current) =>
        advanceMarineSimulationState(current, speciesSeed, random, Date.now())
      );
    }, 7_000);

    return () => {
      window.clearTimeout(initializeTimer);
      window.clearInterval(refreshTimer);
    };
  }, [isSimulated, speciesSeed]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(clockTimer);
  }, []);

  const temperature = metric(simulation.seaSurfaceTemperature, "°C");
  const waves = metric(simulation.waveHeight, "m");
  const current = metric(simulation.oceanCurrent, "m/s");
  const wind = `${metric(simulation.windSpeed, "km/h", 0)} · ${simulation.windDirection}`;
  const suitability = suitabilityBand(simulation.fishingSuitability, copy);
  const actionKey = recommendedAction(simulation);
  const userStatus =
    actionKey === "delay"
      ? "critical"
      : actionKey === "reduce" || actionKey === "caution"
        ? "low"
        : suitability.key;
  const userMarineStatus = copy.marineStatuses[userStatus];
  const explanationKey = userStatus === "critical" || userStatus === "low"
    ? userStatus
    : suitability.key;
  const updated = new Date(simulation.updatedAt);
  const lastUpdated = Number.isNaN(updated.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(updated);
  const secondsSinceUpdate = Math.max(
    0,
    Math.floor((clockNow - simulation.updatedAt) / 1_000)
  );
  const environmentStatus =
    simulation.waveTurbulence < 42 && simulation.windSpeed < 20
      ? copy.stable
      : copy.variable;
  const trendText = simulation.trend === 0
    ? copy.trendSteady
    : copy.trendFromPrevious(simulation.trend);
  const trendTone = simulation.trend > 0
    ? "positive"
    : simulation.trend < 0
      ? "negative"
      : "steady";
  const sourceStatus = isSimulated
    ? copy.sourceStatuses.SIMULATED
    : copy.sourceStatuses[result.source];
  const providerName = isSimulated
    ? copy.demoProvider
    : result.dataset.metadata.providerName;
  const scoreComponents = [
    { label: copy.vesselActivity, value: simulation.vesselActivity, weight: 30 },
    { label: copy.environmentalSuitability, value: simulation.environmentalSuitability, weight: 20 },
    { label: copy.oceanConditions, value: simulation.oceanConditions, weight: 15 },
    { label: copy.vesselDensity, value: simulation.vesselDensity, weight: 15 },
    { label: copy.historicalActivity, value: simulation.historicalActivity, weight: 20 },
  ];
  const conditionGroups = [
    {
      key: "sea",
      label: copy.conditionGroups.sea,
      metrics: [
        { key: "temperature", label: copy.seaTemperature, icon: "°", value: temperature, score: simulation.metricScores.seaTemperature },
        { key: "waves", label: copy.waveHeight, icon: "≈", value: waves, score: simulation.metricScores.waveHeight },
        { key: "turbulence", label: copy.waveTurbulence, icon: "⌁", value: `${Math.round(simulation.waveTurbulence)}%`, score: simulation.metricScores.waveTurbulence },
        { key: "current", label: copy.oceanCurrent, icon: "⇢", value: current, score: simulation.metricScores.oceanCurrent },
      ],
    },
    {
      key: "wind",
      label: copy.conditionGroups.wind,
      metrics: [
        { key: "wind", label: copy.windSpeed, icon: "↗", value: metric(simulation.windSpeed, "km/h", 0), score: simulation.metricScores.windSpeed },
        { key: "direction", label: copy.windDirection, icon: "⌖", value: `${simulation.windDirection} · ${Math.round(simulation.windDirectionDegrees)}°`, score: simulation.metricScores.windDirection },
        { key: "gradient", label: copy.windGradient, icon: "↔", value: metric(simulation.windGradient, "km/h"), score: simulation.metricScores.windGradient },
      ],
    },
    {
      key: "biological",
      label: copy.conditionGroups.biological,
      metrics: [
        { key: "chlorophyll", label: copy.chlorophyll, icon: "✳", value: metric(simulation.chlorophyll, "mg/m³", 2), score: simulation.metricScores.chlorophyll },
        { key: "productivity", label: copy.productivity, icon: "✧", value: `${metric(simulation.chlorophyll, "mg/m³", 2)} · ${copy.proxy}`, score: simulation.metricScores.productivity },
      ],
    },
  ] as const;
  const voiceIntelligence = {
    score: simulation.fishingSuitability,
    classification: suitability.label,
    temperature,
    waves,
    wind,
    species: simulation.targetSpecies.join(", "),
    source: isSimulated ? "SIMULATED" as const : result.source,
  };
  const scoreCircleStyle = {
    "--marine-score-angle": `${simulation.fishingSuitability * 3.6}deg`,
  } as CSSProperties;

  return (
    <>
      <div className="fishing-header">
        <div>
          <p className="section-number">{copy.sectionLabel}</p>
          <h2>
            {copy.headline.map((line) => (
              <span key={line}>{line}<br /></span>
            ))}
          </h2>
          <p className="fishing-description">{copy.description}</p>
        </div>
        <div className="fishing-header-tools">
          <div className="fishing-language-selector" role="group" aria-label={copy.title}>
            <span>{copy.title}</span>
            <div className="fishing-language-options">
              {(["en", "ta", "ml"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={language === option}
                  className={language === option ? "active" : ""}
                  onClick={() => onLanguageChange(option)}
                >
                  {copy.languageNames[option]}
                </button>
              ))}
            </div>
          </div>
          <div className="regional-model">
            <span>✧</span>
            {copy.regionalModel}
          </div>
        </div>
      </div>

      <div className="marine-overview-bar">
        <div>
          <span>{copy.currentMarineStatus}</span>
          <strong className={`marine-overall-status ${userStatus}`} role="status">
            <i />
            {userMarineStatus}
          </strong>
        </div>
        {isSimulated && (
          <span className="marine-simulated-badge">
            <i />
            {copy.simulatedData}
          </span>
        )}
      </div>

      <div className="fishing-intelligence-grid marine-intelligence-score">
        <div className="fishing-score-card">
          <div className="marine-score-topline">
            <span className="fishing-card-title">{copy.score}</span>
            <strong>{zone.name}</strong>
          </div>
          <div className="marine-score-main">
            <div className="score-circle" style={scoreCircleStyle}>
              <div className="score-inner">
                <strong key={simulation.fishingSuitability} className="marine-refresh-highlight">
                  {simulation.fishingSuitability}
                </strong>
                <span>/100</span>
              </div>
            </div>
            <div className="marine-score-result">
              <span className={`classification ${suitability.key}`}>{suitability.label.toUpperCase()}</span>
              <strong className={`marine-trend ${trendTone}`}>
                {simulation.trend === 0 ? copy.trendSteady : trendText}
              </strong>
            </div>
          </div>
          <div className="marine-score-signals">
            <div>
              <span>{copy.environmentStatus}</span>
              <strong className={environmentStatus === copy.stable ? "stable" : "variable"}>
                {environmentStatus}
              </strong>
            </div>
            <div>
              <span>{copy.dataUpdate}</span>
              <strong>{copy.secondsAgo(secondsSinceUpdate)}</strong>
            </div>
          </div>
        </div>
      </div>

      <section className={`marine-meaning-card ${suitability.key}`}>
        <div className="marine-meaning-heading">
          <span className="marine-meaning-check" aria-hidden="true">
            {suitability.key === "critical" || suitability.key === "low" ? "!" : "✓"}
          </span>
          <div>
            <span>{copy.whatThisMeans}</span>
            <strong>{suitability.label}</strong>
          </div>
        </div>
        <p>{copy.explanations[explanationKey]}</p>
      </section>

      {conditionGroups.map((group) => (
        <section className={`marine-condition-section marine-condition-${group.key}`} key={group.key}>
          <div className="marine-section-heading">
            <h3>{group.label}</h3>
          </div>
          <div className="marine-condition-grid">
            {group.metrics.map((item) => {
              const stateKey = conditionStatus(item.key, simulation);
              return (
                <article className={`marine-condition-card status-${stateKey}`} key={item.key}>
                  <div className="marine-condition-card-heading">
                    <span className="marine-condition-icon" aria-hidden="true">{item.icon}</span>
                    <strong>{item.label}</strong>
                  </div>
                  <strong key={`${item.key}:${item.value}`} className="marine-condition-value marine-refresh-highlight">
                    {item.value}
                  </strong>
                  <span className="marine-condition-status">{copy.conditionLabels[stateKey]}</span>
                  <div className="factor-bar marine-condition-bar" aria-hidden="true">
                    <div className="factor-fill" style={{ width: `${item.score}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="marine-detail-grid">
        <article className="marine-detail-card marine-species-card">
          <h3>{copy.likelySpecies}</h3>
          <div className="marine-species-list">
            {simulation.targetSpecies.map((speciesName) => {
              const likelihood = speciesLikelihood(speciesName, simulation);
              return (
                <div className="marine-species-item" key={speciesName}>
                  <span aria-hidden="true">🐟</span>
                  <strong>{speciesName}</strong>
                  <small className={`likelihood-${likelihood}`}>{copy.likelihood[likelihood]}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="marine-detail-card marine-breakdown-card">
          <h3>{copy.scoreBreakdown}</h3>
          <div className="marine-score-breakdown">
            {scoreComponents.map((item) => (
              <div key={item.label}>
                <div className="marine-breakdown-row">
                  <span>{item.label} <small>{item.weight}%</small></span>
                  <strong key={`${item.label}:${item.value}`} className="marine-refresh-highlight">
                    <span>{item.value}</span>
                    <small>/100</small>
                  </strong>
                </div>
                <div className="marine-breakdown-track" aria-hidden="true">
                  <i style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <details className="marine-methodology-details">
            <summary>{copy.methodology}</summary>
            <p className="marine-methodology">{copy.methodologyText}</p>
          </details>
        </article>

        <article className="marine-detail-card marine-advisory">
          <div className="advisory-title">↗ {copy.advisory}</div>
          <div className={`marine-recommendation-status recommendation-${actionKey}`}>
            <span aria-hidden="true">{actionKey === "normal" ? "✓" : actionKey === "delay" ? "×" : "⚠"}</span>
            {copy.recommendations[actionKey].label}
          </div>
          <div key={simulation.advisoryKey} className="advisory-message marine-advisory-refresh">
            {copy.advisories[simulation.advisoryKey]}
          </div>
          <div className="marine-recommended-action">
            <span>{copy.recommendedAction}</span>
            <p>{copy.recommendations[actionKey].action}</p>
          </div>
          <p className="marine-advisory-note">{copy.advisoryDescription}</p>
        </article>
      </section>

      <VoiceAssistant
        language={language}
        copy={copy}
        intelligence={voiceIntelligence}
      />

      <section className="marine-provenance">
        <h3>{copy.provenance}</h3>
        <div>
          <span>{copy.source}</span>
          <strong>{sourceStatus}</strong>
        </div>
        <div>
          <span>{copy.provider}</span>
          <strong>{providerName}</strong>
        </div>
        <div>
          <span>{copy.confidence}</span>
          <strong key={simulation.confidence} className="marine-refresh-highlight">
            {simulation.confidence}%
          </strong>
        </div>
        <div>
          <span>{copy.lastUpdated}</span>
          <strong key={simulation.updatedAt} className="marine-refresh-highlight">
            {lastUpdated}
          </strong>
        </div>
        {isSimulated && (
          <p className="marine-simulated-warning">{copy.simulatedWarning}</p>
        )}
      </section>
    </>
  );
}

export default function MarineFishingIntelligence() {
  const provider = useMemo(() => new HybridFishingDataProvider(), []);
  const [result, setResult] = useState<FishingDataResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [language, setLanguage] = useState<FishingLanguage>("en");

  useEffect(() => {
    let active = true;
    provider.load().then(
      (loaded) => {
        if (!active) return;
        setResult(loaded);
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : `Unable to load fishing intelligence: ${String(error)}`
        );
      }
    );

    return () => {
      active = false;
    };
  }, [provider]);

  const copy = fishingCopy[language];

  return (
    <>
      {result ? (
        <MarineIntelligencePanel
          result={result}
          language={language}
          onLanguageChange={setLanguage}
        />
      ) : (
        <section className="marine-intelligence-loading" aria-live="polite">
          {loadError ? (
            <p role="alert">{copy.unavailable} {loadError}</p>
          ) : (
            <p>{copy.loading}</p>
          )}
        </section>
      )}
      <FishingMap result={result} loadError={loadError} />
      <div className="fishing-footer">
        <span>{copy.footerActive}</span>
        <span>{copy.footerModel}</span>
        <span>{copy.footerRegion}</span>
      </div>
    </>
  );
}
