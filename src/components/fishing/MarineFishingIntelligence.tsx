import { useEffect, useMemo, useState } from "react";
import VoiceAssistant from "./VoiceAssistant";
import FishingMap from "./FishingMap";
import { fishingCopy, type FishingLanguage } from "../../i18n/fishing";
import { HybridFishingDataProvider } from "../../services/fishing/HybridFishingDataProvider";
import type {
  FishingDataResult,
  FishingZone,
  OceanCondition,
} from "../../services/fishing/types";
import {
  calculateFishingIntelligence,
} from "../../utils/fishing/calculateFishingRisk";
import { getActivitySnapshot } from "../../utils/fishing/getActivitySnapshot";

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

function MarineIntelligencePanel({
  result,
  language,
  onLanguageChange,
}: {
  result: FishingDataResult;
  language: FishingLanguage;
  onLanguageChange: (language: FishingLanguage) => void;
}) {
  const copy = fishingCopy[language];
  const locale = `${language}-IN`;
  const zone = result.dataset.zones.find(
    (candidate) => candidate.zoneType === "FISHING"
  );

  if (!zone) {
    return <p className="marine-intelligence-error">{copy.unavailable}</p>;
  }

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
  const condition = nearestCondition(zone, result.dataset.oceanConditions);
  const windSpeeds = result.dataset.oceanConditions
    .map((reading) => reading.windSpeed)
    .filter((speed): speed is number => speed !== undefined);
  const windGradient =
    windSpeeds.length > 1
      ? `${Math.min(...windSpeeds)}–${Math.max(...windSpeeds)} km/h`
      : metric(windSpeeds[0], "km/h", 0);
  const waveLevel =
    condition?.waveHeight === undefined
      ? copy.unavailable
      : condition.waveHeight < 1
        ? copy.waveLevels.calm
        : condition.waveHeight <= 2
          ? copy.waveLevels.moderate
          : copy.waveLevels.rough;
  const temperature = metric(condition?.seaSurfaceTemperature, "°C");
  const waves = metric(condition?.waveHeight, "m");
  const wind = [
    metric(condition?.windSpeed, "km/h", 0),
    condition?.windDirection,
  ]
    .filter(Boolean)
    .join(" · ") || "—";
  const species = zone.species?.join(", ") || "—";
  const classification = copy.riskLevels[intelligence.riskLevel];
  const updated = new Date(result.dataset.metadata.timestamp);
  const lastUpdated = Number.isNaN(updated.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(updated);
  const scoreComponents = [
    { label: copy.vesselActivity, value: intelligence.vesselActivity, weight: 30 },
    { label: copy.historicalActivity, value: intelligence.historicalActivity, weight: 20 },
    { label: copy.environmentalSuitability, value: intelligence.environmentalScore, weight: 20 },
    { label: copy.vesselDensity, value: intelligence.vesselDensity, weight: 15 },
    { label: copy.oceanConditions, value: intelligence.oceanConditionsScore, weight: 15 },
  ];
  const environmentalMetrics = [
    {
      label: copy.seaTemperature,
      value: temperature,
      score: condition?.seaSurfaceTemperature === undefined
        ? 50
        : Math.max(0, Math.min(100, 100 - (Math.abs(condition.seaSurfaceTemperature - 28) / 4) * 100)),
    },
    {
      label: copy.waveHeight,
      value: waves,
      score: condition?.waveHeight === undefined
        ? 50
        : Math.max(0, Math.min(100, 100 - (condition.waveHeight / 5) * 100)),
    },
    {
      label: copy.waveTurbulence,
      value: condition?.waveHeight === undefined ? "—" : `${waveLevel} · ${waves}`,
      score: condition?.waveHeight === undefined
        ? 50
        : Math.max(0, Math.min(100, 100 - (condition.waveHeight / 5) * 100)),
    },
    {
      label: copy.windSpeed,
      value: metric(condition?.windSpeed, "km/h", 0),
      score: condition?.windSpeed === undefined
        ? 50
        : Math.max(0, Math.min(100, 100 - (condition.windSpeed / 60) * 100)),
    },
    {
      label: copy.windDirection,
      value: condition?.windDirection ?? "—",
      score: condition?.windDirectionDegrees === undefined
        ? 50
        : 100,
    },
    {
      label: copy.windGradient,
      value: windGradient,
      score: windSpeeds.length > 1
        ? Math.max(0, 100 - (Math.max(...windSpeeds) - Math.min(...windSpeeds)) * 2)
        : 50,
    },
    {
      label: copy.oceanCurrent,
      value: metric(condition?.currentSpeed, "m/s"),
      score: condition?.currentSpeed === undefined
        ? 50
        : Math.max(0, Math.min(100, 100 - (Math.abs(condition.currentSpeed - 0.6) / 2) * 100)),
    },
    {
      label: copy.chlorophyll,
      value: metric(condition?.chlorophyll, "mg/m³", 2),
      score: condition?.chlorophyll === undefined
        ? 50
        : Math.max(0, Math.min(100, 100 - (Math.abs(condition.chlorophyll - 0.7) / 1.2) * 100)),
    },
    {
      label: copy.productivity,
      value: condition?.chlorophyll === undefined
        ? "—"
        : `${metric(condition.chlorophyll, "mg/m³", 2)} · ${copy.proxy}`,
      score: condition?.chlorophyll === undefined
        ? 50
        : Math.max(0, Math.min(100, 100 - (Math.abs(condition.chlorophyll - 0.7) / 1.2) * 100)),
    },
  ];
  const voiceIntelligence = {
    score: intelligence.activityScore,
    classification,
    temperature,
    waves,
    wind,
    species,
    source: result.source,
  };
  const sourceStatus = copy.sourceStatuses[result.source];
  const providerName =
    result.dataset.metadata.providerName === "Deterministic demo dataset"
      ? copy.demoProvider
      : result.dataset.metadata.providerName;

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

      <div className="fishing-intelligence-grid marine-intelligence-score">
        <div className="fishing-score-card">
          <span className="fishing-card-title">{copy.score}</span>
          <div
            className="score-circle"
            style={{
              background: `conic-gradient(#43d9dd 0deg, #43d9dd ${intelligence.activityScore * 3.6}deg, rgba(67, 217, 221, 0.12) ${intelligence.activityScore * 3.6}deg, rgba(67, 217, 221, 0.12) 360deg)`,
            }}
          >
            <div className="score-inner">
              <strong>{intelligence.activityScore}</strong>
              <span>/100</span>
            </div>
          </div>
          <div className="classification">
            {copy.classification}: {classification}
          </div>
          <div className="marine-score-meta">
            {zone.name} · {sourceStatus}
          </div>
        </div>
      </div>

      <div className="factor-heading">{copy.parameters}</div>
      <div className="factor-grid marine-environment-grid">
        {environmentalMetrics.map((item) => (
          <div className="factor-card marine-metric-card" key={item.label}>
            <div className="factor-top">
              <strong>{item.label}</strong>
              <span>{item.value}</span>
            </div>
            <div className="factor-bar">
              <div
                className="factor-fill"
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <section className="marine-detail-grid">
        <article className="marine-detail-card">
          <h3>{copy.targetSpecies}</h3>
          <p className="marine-species">{species}</p>
          <h3>{copy.scoreBreakdown}</h3>
          <div className="marine-score-breakdown">
            {scoreComponents.map((item) => (
              <div key={item.label}>
                <span>{item.label} <small>{item.weight}%</small></span>
                <strong>{item.value}/100</strong>
              </div>
            ))}
          </div>
          <h3>{copy.methodology}</h3>
          <p className="marine-methodology">{copy.methodologyText}</p>
        </article>
        <article className="marine-detail-card marine-advisory">
          <div className="advisory-title">↗ {copy.advisory}</div>
          <div className="advisory-message">{copy.advisoryMessage}</div>
          <p>{copy.advisoryDescription}</p>
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
          <strong>{intelligence.confidence}%</strong>
        </div>
        <div>
          <span>{copy.lastUpdated}</span>
          <strong>{lastUpdated}</strong>
        </div>
        {result.source === "SIMULATED" && (
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
