export type FishingLanguage = "en" | "ta" | "ml";

export const fishingLocales: Record<FishingLanguage, string> = {
  en: "en-IN",
  ta: "ta-IN",
  ml: "ml-IN",
};

export interface FishingCopy {
  title: string;
  sectionLabel: string;
  headline: string[];
  description: string;
  regionalModel: string;
  footerActive: string;
  footerModel: string;
  footerRegion: string;
  score: string;
  advisory: string;
  advisoryDescription: string;
  currentMarineStatus: string;
  marineStatuses: Record<"excellent" | "good" | "moderate" | "low" | "critical", string>;
  simulatedData: string;
  whatThisMeans: string;
  explanations: Record<"excellent" | "good" | "moderate" | "low" | "critical", string>;
  conditionGroups: { sea: string; wind: string; biological: string };
  conditionLabels: { optimal: string; favorable: string; moderate: string; caution: string; high: string };
  likelySpecies: string;
  likelihood: { high: string; medium: string };
  recommendedAction: string;
  recommendations: Record<"normal" | "caution" | "reduce" | "delay", { label: string; action: string }>;
  environmentStatus: string;
  stable: string;
  variable: string;
  dataUpdate: string;
  trend: string;
  secondsAgo: (seconds: number) => string;
  trendSteady: string;
  suitabilityBands: {
    excellent: string;
    good: string;
    moderate: string;
    low: string;
    critical: string;
  };
  trendFromPrevious: (trend: number) => string;
  advisories: Record<
    "favorable" | "stable" | "waves" | "wind" | "improving" | "caution",
    string
  >;
  seaTemperature: string;
  waveHeight: string;
  waveTurbulence: string;
  windSpeed: string;
  windDirection: string;
  windGradient: string;
  oceanCurrent: string;
  chlorophyll: string;
  productivity: string;
  proxy: string;
  scoreBreakdown: string;
  vesselActivity: string;
  historicalActivity: string;
  environmentalSuitability: string;
  vesselDensity: string;
  oceanConditions: string;
  methodology: string;
  methodologyText: string;
  confidence: string;
  provenance: string;
  lastUpdated: string;
  source: string;
  provider: string;
  demoProvider: string;
  sourceStatuses: Record<"LIVE" | "CACHED" | "SIMULATED", string>;
  voiceAssistant: string;
  microphone: string;
  ready: string;
  listening: string;
  speaking: string;
  voiceInputUnsupported: string;
  speechOutputUnsupported: string;
  voiceError: string;
  voiceDescription: string;
  suggestedQuestions: string[];
  suitabilityAnswer: (score: number, classification: string, temperature: string, waves: string) => string;
  temperatureAnswer: (temperature: string) => string;
  windAnswer: (wind: string) => string;
  speciesAnswer: (species: string) => string;
  favorableAnswer: (score: number, classification: string) => string;
  simulatedWarning: string;
  waveLevels: { calm: string; moderate: string; rough: string };
  languageNames: Record<FishingLanguage, string>;
  loading: string;
  unavailable: string;
}

export const fishingCopy: Record<FishingLanguage, FishingCopy> = {
  en: {
    title: "AI MARINE INTELLIGENCE",
      sectionLabel: "05 / FISHING INTELLIGENCE",
      headline: ["FIND", "THE RIGHT", "WATERS."],
    description: "AI-analyzed ocean biological parameters for Tamil deep-sea fishermen.",
    regionalModel: "Regional Model: Gulf of Mannar",
    footerActive: "● FISHING INTELLIGENCE ACTIVE",
    footerModel: "AI MODEL / ACTIVE",
    footerRegion: "TAMIL NADU DEEP-SEA FISHERIES",
    score: "FISHING SUITABILITY SCORE",
    advisory: "AI MARINE ADVISORY",
    advisoryDescription: "This recommendation reflects the current marine conditions and fishing indicators.",
    currentMarineStatus: "CURRENT MARINE STATUS",
    marineStatuses: { excellent: "EXCELLENT FOR FISHING", good: "FAVORABLE FOR FISHING", moderate: "MODERATE CONDITIONS", low: "CAUTION ADVISED", critical: "UNFAVORABLE CONDITIONS" },
    simulatedData: "SIMULATED DATA",
    whatThisMeans: "WHAT THIS MEANS",
    explanations: {
      excellent: "Conditions are excellent. Suitable temperatures, steady currents and calm seas support fishing activity.",
      good: "Fishing conditions are favorable. Sea temperature and current conditions are supporting good fishing activity.",
      moderate: "Fishing is possible, but changing waves and wind may affect smaller vessels.",
      low: "Fishing suitability is reduced due to stronger winds or rougher sea conditions.",
      critical: "Sea conditions are unfavorable. Consider delaying fishing activity and check local safety guidance.",
    },
    conditionGroups: { sea: "SEA CONDITIONS", wind: "WIND CONDITIONS", biological: "BIOLOGICAL CONDITIONS" },
    conditionLabels: { optimal: "OPTIMAL", favorable: "FAVORABLE", moderate: "MODERATE", caution: "CAUTION", high: "HIGH" },
    likelySpecies: "LIKELY SPECIES",
    likelihood: { high: "HIGH", medium: "MEDIUM" },
    recommendedAction: "RECOMMENDED ACTION",
    recommendations: {
      normal: { label: "NORMAL ACTIVITY", action: "Conditions are favorable for fishing. Continue normal activity and keep monitoring local weather." },
      caution: { label: "PROCEED WITH CAUTION", action: "Monitor wind and wave conditions closely, especially for smaller vessels." },
      reduce: { label: "REDUCE OFFSHORE ACTIVITY", action: "Rougher conditions are developing. Prefer sheltered routes and limit offshore exposure." },
      delay: { label: "CONSIDER DELAYING", action: "Sea conditions are currently unfavorable. Wait for conditions to improve and follow local safety guidance." },
    },
    environmentStatus: "ENVIRONMENT STATUS",
    stable: "Stable",
    variable: "Variable",
    dataUpdate: "DATA UPDATE",
    trend: "TREND",
    secondsAgo: (seconds) => `${seconds}s ago`,
    trendSteady: "→ Steady vs previous reading",
    trendFromPrevious: (trend) => `${trend > 0 ? "↑ +" : "↓ "}${Math.abs(trend)}% from previous reading`,
    suitabilityBands: { excellent: "Excellent", good: "Good", moderate: "Moderate", low: "Low", critical: "Critical" },
    advisories: {
      favorable: "Fishing conditions are favorable in this region.",
      stable: "Sea conditions are stable with favorable temperature and current patterns.",
      waves: "Moderate wave activity detected. Small vessels should operate with caution.",
      wind: "Elevated wind speeds are reducing fishing suitability.",
      improving: "Ocean conditions are improving. Fishing suitability has increased.",
      caution: "Ocean conditions are variable. Review vessel safety before fishing.",
    },
    seaTemperature: "Sea surface temperature",
    waveHeight: "Wave height",
    waveTurbulence: "Wave turbulence",
    windSpeed: "Wind speed",
    windDirection: "Wind direction",
    windGradient: "Coastal wind gradient",
    oceanCurrent: "Ocean current",
    chlorophyll: "Chlorophyll-a",
    productivity: "Biological productivity (chlorophyll proxy)",
    proxy: "proxy",
    scoreBreakdown: "WHY THIS SCORE?",
    vesselActivity: "Vessel activity",
    historicalActivity: "Historical fishing activity",
    environmentalSuitability: "Environmental health",
    vesselDensity: "Vessel density",
    oceanConditions: "Ocean conditions",
    methodology: "Calculation methodology",
    methodologyText: "30% vessel activity + 20% historical fishing activity + 20% environmental suitability + 15% vessel density + 15% ocean conditions.",
    confidence: "Confidence",
    provenance: "DATA PROVENANCE",
    lastUpdated: "Last updated",
    source: "Status",
    provider: "Source",
    demoProvider: "DEMO ENVIRONMENTAL DATASET",
    sourceStatuses: { LIVE: "LIVE", CACHED: "CACHED", SIMULATED: "SIMULATED" },
    voiceAssistant: "AI MARINE VOICE ASSISTANT",
    microphone: "Start voice input",
    ready: "READY",
    listening: "LISTENING",
    speaking: "SPEAKING",
    voiceInputUnsupported: "Voice input is not supported in this browser.",
    speechOutputUnsupported: "Speech output is not supported; the response is shown as text.",
    voiceError: "Voice input could not be started. Please try again.",
    voiceDescription: "Ask Neythal about current fishing conditions.",
    suggestedQuestions: ["What is the fishing score?", "Is the sea safe?", "Which fish are likely?", "How strong is the wind?"],
    suitabilityAnswer: (score, classification, temperature, waves) =>
      `Fishing suitability is ${score} out of 100. The current classification is ${classification}. Sea temperature is ${temperature} and wave height is ${waves}.`,
    temperatureAnswer: (temperature) => `The latest sea surface temperature is ${temperature}.`,
    windAnswer: (wind) => `The latest wind reading is ${wind}.`,
    speciesAnswer: (species) => `The indicated target species are ${species}.`,
    favorableAnswer: (score, classification) =>
      `Fishing suitability is ${score} out of 100, classified as ${classification}.`,
    simulatedWarning: "This is simulated prototype intelligence and is not official fishing or navigation advice.",
    waveLevels: { calm: "Calm", moderate: "Moderate", rough: "Rough" },
    languageNames: { en: "EN", ta: "தமிழ்", ml: "മലയാളം" },
    loading: "Loading normalized marine intelligence…",
    unavailable: "Marine intelligence is currently unavailable.",
  },
  ta: {
    title: "AI கடல் நுண்ணறிவு",
    sectionLabel: "05 / மீன்பிடி நுண்ணறிவு",
    headline: ["சரியான", "மீன்பிடிப்", "பகுதிகளைக் கண்டறியுங்கள்."],
    description: "தமிழக ஆழ்கடல் மீனவர்களுக்கான AI ஆய்வு செய்யப்பட்ட கடல் உயிரியல் அளவுருக்கள்.",
    regionalModel: "பிராந்திய மாதிரி: மன்னார் வளைகுடா",
    footerActive: "● மீன்பிடி நுண்ணறிவு செயல்பாட்டில்",
    footerModel: "AI மாதிரி / செயல்பாட்டில்",
    footerRegion: "தமிழ்நாடு ஆழ்கடல் மீன்பிடி",
    score: "மீன்பிடி திறன் மதிப்பெண்",
    advisory: "AI கடல் ஆலோசனை",
    advisoryDescription: "தற்போதைய கடல் நிலை மற்றும் மீன்பிடி குறியீடுகளின் அடிப்படையில் இந்தப் பரிந்துரை வழங்கப்படுகிறது.",
    currentMarineStatus: "தற்போதைய கடல் நிலை",
    marineStatuses: { excellent: "மீன்பிடிக்கு மிகச் சிறந்தது", good: "மீன்பிடிக்கு சாதகமானது", moderate: "மிதமான நிலை", low: "எச்சரிக்கை அவசியம்", critical: "சாதகமற்ற கடல் நிலை" },
    simulatedData: "மாதிரி தரவு",
    whatThisMeans: "இதன் பொருள் என்ன",
    explanations: {
      excellent: "நிலைமைகள் மிகச் சிறப்பாக உள்ளன. ஏற்ற வெப்பநிலை, நிலையான நீரோட்டம், அமைதியான கடல் மீன்பிடிக்கு உதவுகின்றன.",
      good: "மீன்பிடி நிலை சாதகமாக உள்ளது. கடல் வெப்பநிலையும் நீரோட்டமும் நல்ல மீன்பிடி செயல்பாட்டை ஆதரிக்கின்றன.",
      moderate: "மீன்பிடிக்கலாம்; ஆனால் மாறும் அலைகளும் காற்றும் சிறிய படகுகளைப் பாதிக்கலாம்.",
      low: "அதிக காற்று அல்லது கடல் கொந்தளிப்பு காரணமாக மீன்பிடி ஏற்றத்தன்மை குறைந்துள்ளது.",
      critical: "கடல் நிலை சாதகமற்றது. மீன்பிடியைத் தாமதித்து உள்ளூர் பாதுகாப்பு வழிகாட்டுதலைப் பார்க்கவும்.",
    },
    conditionGroups: { sea: "கடல் நிலை", wind: "காற்று நிலை", biological: "உயிரியல் நிலை" },
    conditionLabels: { optimal: "மிகச் சிறப்பு", favorable: "சாதகம்", moderate: "மிதமானது", caution: "எச்சரிக்கை", high: "அதிகம்" },
    likelySpecies: "வாய்ப்புள்ள மீன் இனங்கள்",
    likelihood: { high: "அதிகம்", medium: "மிதமானது" },
    recommendedAction: "பரிந்துரைக்கப்படும் நடவடிக்கை",
    recommendations: {
      normal: { label: "வழக்கமான செயல்பாடு", action: "மீன்பிடிக்கு நிலைமைகள் சாதகமாக உள்ளன. வழக்கமான செயல்பாட்டைத் தொடர்ந்து உள்ளூர் வானிலையைக் கண்காணிக்கவும்." },
      caution: { label: "எச்சரிக்கையுடன் செல்லவும்", action: "குறிப்பாக சிறிய படகுகள் காற்று மற்றும் அலை நிலையை கவனமாகக் கண்காணிக்கவும்." },
      reduce: { label: "கடலுக்கு வெளியே செல்வதைக் குறைக்கவும்", action: "கடல் கொந்தளிப்பு அதிகரிக்கிறது. பாதுகாப்பான பாதைகளைத் தேர்ந்தெடுத்து வெளிக்கடல் பயணத்தைக் குறைக்கவும்." },
      delay: { label: "தாமதிப்பதைப் பரிசீலிக்கவும்", action: "தற்போதைய கடல் நிலை சாதகமற்றது. நிலை மேம்படும் வரை காத்திருந்து உள்ளூர் பாதுகாப்பு வழிகாட்டுதலைப் பின்பற்றவும்." },
    },
    environmentStatus: "சுற்றுச்சூழல் நிலை",
    stable: "நிலையானது",
    variable: "மாறுபடும்",
    dataUpdate: "தரவு புதுப்பிப்பு",
    trend: "போக்கு",
    secondsAgo: (seconds) => `${seconds} வி. முன்`,
    trendSteady: "→ முந்தைய அளவீட்டைப் போலவே",
    trendFromPrevious: (trend) => `${trend > 0 ? "↑ +" : "↓ "}${Math.abs(trend)}% முந்தைய அளவீட்டிலிருந்து`,
    suitabilityBands: { excellent: "மிகச் சிறந்தது", good: "நல்லது", moderate: "மிதமானது", low: "குறைவு", critical: "மிகக் குறைவு" },
    advisories: {
      favorable: "இந்த பகுதியில் மீன்பிடிக்க ஏற்ற சூழ்நிலை உள்ளது.",
      stable: "வெப்பநிலை மற்றும் நீரோட்டம் சாதகமாக உள்ளதால் கடல் நிலை சீராக உள்ளது.",
      waves: "மிதமான அலை இயக்கம் உள்ளது. சிறிய படகுகள் எச்சரிக்கையுடன் செல்ல வேண்டும்.",
      wind: "அதிகரித்த காற்று வேகம் மீன்பிடி ஏற்றத்தன்மையைக் குறைக்கிறது.",
      improving: "கடல் நிலை மேம்படுகிறது. மீன்பிடி ஏற்றத்தன்மை அதிகரித்துள்ளது.",
      caution: "கடல் நிலை மாறுபடுகிறது. மீன்பிடிக்க முன் படகு பாதுகாப்பைச் சரிபார்க்கவும்.",
    },
    seaTemperature: "கடல் மேற்பரப்பு வெப்பநிலை",
    waveHeight: "அலை உயரம்",
    waveTurbulence: "அலை கொந்தளிப்பு",
    windSpeed: "காற்றின் வேகம்",
    windDirection: "காற்றின் திசை",
    windGradient: "கடலோர காற்று வேறுபாடு",
    oceanCurrent: "கடல் நீரோட்டம்",
    chlorophyll: "குளோரோஃபில்-a",
    productivity: "உயிரியல் உற்பத்தித்திறன் (குளோரோஃபில் மதிப்பீடு)",
    proxy: "மதிப்பீடு",
    scoreBreakdown: "இந்த மதிப்பெண் ஏன்?",
    vesselActivity: "படகு செயல்பாடு",
    historicalActivity: "வரலாற்று மீன்பிடி செயல்பாடு",
    environmentalSuitability: "சுற்றுச்சூழல் நிலை",
    vesselDensity: "படகு அடர்த்தி",
    oceanConditions: "கடல் நிலைமைகள்",
    methodology: "கணக்கீட்டு முறை",
    methodologyText: "30% படகு செயல்பாடு + 20% வரலாற்று மீன்பிடி செயல்பாடு + 20% சுற்றுச்சூழல் ஏற்றத்தன்மை + 15% படகு அடர்த்தி + 15% கடல் நிலைமைகள்.",
    confidence: "நம்பகத்தன்மை",
    provenance: "தரவு மூலம்",
    lastUpdated: "கடைசியாக புதுப்பிக்கப்பட்டது",
    source: "நிலை",
    provider: "தரவு மூலம்",
    demoProvider: "மாதிரி சுற்றுச்சூழல் தரவுத்தொகுப்பு",
    sourceStatuses: { LIVE: "நேரடி", CACHED: "சேமிக்கப்பட்டது", SIMULATED: "மாதிரி தரவு" },
    voiceAssistant: "AI கடல் குரல் உதவியாளர்",
    microphone: "குரல் உள்ளீட்டைத் தொடங்கு",
    ready: "தயார்",
    listening: "கேட்கிறது",
    speaking: "பேசுகிறது",
    voiceInputUnsupported: "இந்த உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை.",
    speechOutputUnsupported: "குரல் வெளியீடு ஆதரிக்கப்படவில்லை; பதில் உரையாகக் காட்டப்படுகிறது.",
    voiceError: "குரல் உள்ளீட்டைத் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    voiceDescription: "தற்போதைய மீன்பிடி நிலைமைகள் பற்றி நெய்தலிடம் கேளுங்கள்.",
    suggestedQuestions: ["மீன்பிடி மதிப்பெண் என்ன?", "கடல் பாதுகாப்பாக உள்ளதா?", "எந்த மீன்கள் கிடைக்கலாம்?", "காற்றின் வேகம் என்ன?"],
    suitabilityAnswer: (score, classification, temperature, waves) =>
      `மீன்பிடி திறன் 100-ல் ${score} மதிப்பெண்கள். தற்போதைய வகைப்பாடு ${classification}. கடல் வெப்பநிலை ${temperature}; அலை உயரம் ${waves}.`,
    temperatureAnswer: (temperature) => `சமீபத்திய கடல் மேற்பரப்பு வெப்பநிலை ${temperature}.`,
    windAnswer: (wind) => `சமீபத்திய காற்று அளவீடு ${wind}.`,
    speciesAnswer: (species) => `குறிப்பிடப்பட்ட இலக்கு மீன் இனங்கள்: ${species}.`,
    favorableAnswer: (score, classification) =>
      `மீன்பிடி திறன் 100-ல் ${score} மதிப்பெண்கள். தற்போதைய வகைப்பாடு ${classification}.`,
    simulatedWarning: "இது ஒரு மாதிரி செயற்கை நுண்ணறிவு தரவு மட்டுமே; அதிகாரப்பூர்வ மீன்பிடி அல்லது வழிசெலுத்தல் ஆலோசனையாக கருத வேண்டாம்.",
    waveLevels: { calm: "அமைதியான", moderate: "மிதமான", rough: "கொந்தளிப்பான" },
    languageNames: { en: "EN", ta: "தமிழ்", ml: "മലയാളം" },
    loading: "ஒருங்கிணைக்கப்பட்ட கடல் நுண்ணறிவு தரவு ஏற்றப்படுகிறது…",
    unavailable: "கடல் நுண்ணறிவு தற்போது கிடைக்கவில்லை.",
  },
  ml: {
    title: "AI സമുദ്ര ഇന്റലിജൻസ്",
    sectionLabel: "05 / മത്സ്യബന്ധന ഇന്റലിജൻസ്",
    headline: ["അനുയോജ്യമായ", "മത്സ്യബന്ധന", "മേഖലകൾ കണ്ടെത്തുക."],
    description: "തമിഴ്നാട്ടിലെ ആഴക്കടൽ മത്സ്യത്തൊഴിലാളികൾക്കായുള്ള AI വിശകലനം ചെയ്ത സമുദ്ര ജൈവ ഘടകങ്ങൾ.",
    regionalModel: "പ്രാദേശിക മാതൃക: മന്നാർ ഉൾക്കടൽ",
    footerActive: "● മത്സ്യബന്ധന ഇന്റലിജൻസ് സജീവം",
    footerModel: "AI മോഡൽ / സജീവം",
    footerRegion: "തമിഴ്നാട് ആഴക്കടൽ മത്സ്യബന്ധനം",
    score: "മത്സ്യബന്ധന അനുയോജ്യതാ സ്കോർ",
    advisory: "AI സമുദ്ര ഉപദേശം",
    advisoryDescription: "നിലവിലെ സമുദ്ര സാഹചര്യങ്ങളെയും മത്സ്യബന്ധന സൂചകങ്ങളെയും അടിസ്ഥാനമാക്കിയുള്ളതാണ് ഈ നിർദേശം.",
    currentMarineStatus: "നിലവിലെ സമുദ്രനില",
    marineStatuses: { excellent: "മത്സ്യബന്ധനത്തിന് മികച്ചത്", good: "മത്സ്യബന്ധനത്തിന് അനുകൂലം", moderate: "മിതമായ സാഹചര്യം", low: "ജാഗ്രത നിർദേശം", critical: "അനുകൂലമല്ലാത്ത സമുദ്രനില" },
    simulatedData: "സിമുലേറ്റഡ് ഡാറ്റ",
    whatThisMeans: "ഇതിന്റെ അർത്ഥം",
    explanations: {
      excellent: "സാഹചര്യങ്ങൾ മികച്ചതാണ്. അനുയോജ്യമായ താപനിലയും സ്ഥിരമായ പ്രവാഹവും ശാന്തമായ കടലും മത്സ്യബന്ധനത്തെ പിന്തുണയ്ക്കുന്നു.",
      good: "മത്സ്യബന്ധനത്തിന് അനുകൂലമായ സാഹചര്യങ്ങളാണ്. കടൽ താപനിലയും പ്രവാഹവും നല്ല പ്രവർത്തനത്തെ പിന്തുണയ്ക്കുന്നു.",
      moderate: "മത്സ്യബന്ധനം സാധ്യമാണ്; മാറുന്ന തിരമാലകളും കാറ്റും ചെറിയ ബോട്ടുകളെ ബാധിക്കാം.",
      low: "ശക്തമായ കാറ്റോ കടൽക്ഷോഭമോ കാരണം മത്സ്യബന്ധന അനുയോജ്യത കുറഞ്ഞിരിക്കുന്നു.",
      critical: "കടൽ സാഹചര്യം അനുകൂലമല്ല. മത്സ്യബന്ധനം മാറ്റിവെച്ച് പ്രാദേശിക സുരക്ഷാ നിർദേശങ്ങൾ പരിശോധിക്കുക.",
    },
    conditionGroups: { sea: "കടൽ സാഹചര്യം", wind: "കാറ്റിന്റെ സാഹചര്യം", biological: "ജൈവ സാഹചര്യം" },
    conditionLabels: { optimal: "മികച്ചത്", favorable: "അനുകൂലം", moderate: "മിതമായത്", caution: "ജാഗ്രത", high: "ഉയർന്നത്" },
    likelySpecies: "സാധ്യതയുള്ള മത്സ്യ ഇനങ്ങൾ",
    likelihood: { high: "ഉയർന്നത്", medium: "മിതമായത്" },
    recommendedAction: "ശുപാർശ ചെയ്യുന്ന നടപടി",
    recommendations: {
      normal: { label: "സാധാരണ പ്രവർത്തനം", action: "മത്സ്യബന്ധനത്തിന് സാഹചര്യം അനുകൂലമാണ്. സാധാരണ പ്രവർത്തനം തുടരുകയും പ്രാദേശിക കാലാവസ്ഥ നിരീക്ഷിക്കുകയും ചെയ്യുക." },
      caution: { label: "ജാഗ്രതയോടെ മുന്നോട്ട് പോകുക", action: "പ്രത്യേകിച്ച് ചെറിയ ബോട്ടുകൾ കാറ്റും തിരമാലയും സൂക്ഷ്മമായി നിരീക്ഷിക്കുക." },
      reduce: { label: "കടലിലേക്ക് പോകുന്നത് കുറയ്ക്കുക", action: "കടൽ കൂടുതൽ പ്രക്ഷുബ്ധമാകുന്നു. സുരക്ഷിത പാതകൾ തിരഞ്ഞെടുക്കുകയും ദൂരക്കടൽ യാത്ര കുറയ്ക്കുകയും ചെയ്യുക." },
      delay: { label: "മാറ്റിവെക്കുന്നത് പരിഗണിക്കുക", action: "നിലവിലെ കടൽ സാഹചര്യം അനുകൂലമല്ല. സാഹചര്യം മെച്ചപ്പെടുന്നത് വരെ കാത്ത് പ്രാദേശിക സുരക്ഷാ നിർദേശങ്ങൾ പാലിക്കുക." },
    },
    environmentStatus: "പരിസ്ഥിതി നില",
    stable: "സ്ഥിരം",
    variable: "മാറുന്നുണ്ട്",
    dataUpdate: "ഡാറ്റ പുതുക്കൽ",
    trend: "പ്രവണത",
    secondsAgo: (seconds) => `${seconds} സെ. മുമ്പ്`,
    trendSteady: "→ മുൻ വായനയോട് സ്ഥിരം",
    trendFromPrevious: (trend) => `${trend > 0 ? "↑ +" : "↓ "}${Math.abs(trend)}% മുൻ വായനയിൽ നിന്ന്`,
    suitabilityBands: { excellent: "മികച്ചത്", good: "നല്ലത്", moderate: "മിതമായത്", low: "കുറവ്", critical: "ഗുരുതരം" },
    advisories: {
      favorable: "ഈ പ്രദേശത്ത് മത്സ്യബന്ധനത്തിന് അനുകൂലമായ സാഹചര്യമുണ്ട്.",
      stable: "അനുകൂലമായ താപനിലയും പ്രവാഹവും കാരണം സമുദ്രസ്ഥിതി സ്ഥിരമാണ്.",
      waves: "മിതമായ തിരമാല പ്രവർത്തനം കണ്ടെത്തി. ചെറിയ ബോട്ടുകൾ ജാഗ്രതയോടെ പ്രവർത്തിക്കുക.",
      wind: "കൂടിയ കാറ്റ് മത്സ്യബന്ധന അനുയോജ്യത കുറയ്ക്കുന്നു.",
      improving: "സമുദ്രസ്ഥിതി മെച്ചപ്പെടുന്നു. മത്സ്യബന്ധന അനുയോജ്യത ഉയർന്നു.",
      caution: "സമുദ്രസ്ഥിതി മാറിക്കൊണ്ടിരിക്കുന്നു. മത്സ്യബന്ധനത്തിന് മുമ്പ് ബോട്ട് സുരക്ഷ പരിശോധിക്കുക.",
    },
    seaTemperature: "സമുദ്ര ഉപരിതല താപനില",
    waveHeight: "തിരമാലയുടെ ഉയരം",
    waveTurbulence: "തിരമാല പ്രക്ഷുബ്ധത",
    windSpeed: "കാറ്റിന്റെ വേഗത",
    windDirection: "കാറ്റിന്റെ ദിശ",
    windGradient: "തീരദേശ കാറ്റിലെ വ്യത്യാസം",
    oceanCurrent: "സമുദ്ര പ്രവാഹം",
    chlorophyll: "ക്ലോറോഫിൽ-a",
    productivity: "ജൈവ ഉൽപ്പാദനക്ഷമത (ക്ലോറോഫിൽ സൂചകം)",
    proxy: "സൂചകം",
    scoreBreakdown: "ഈ സ്കോർ എന്തുകൊണ്ട്?",
    vesselActivity: "ബോട്ടുകളുടെ പ്രവർത്തനം",
    historicalActivity: "ചരിത്രപരമായ മത്സ്യബന്ധന പ്രവർത്തനം",
    environmentalSuitability: "പരിസ്ഥിതി ആരോഗ്യം",
    vesselDensity: "ബോട്ടുകളുടെ സാന്ദ്രത",
    oceanConditions: "സമുദ്ര സാഹചര്യങ്ങൾ",
    methodology: "കണക്കുകൂട്ടൽ രീതി",
    methodologyText: "30% ബോട്ടുകളുടെ പ്രവർത്തനം + 20% ചരിത്രപരമായ മത്സ്യബന്ധനം + 20% പരിസ്ഥിതി അനുയോജ്യത + 15% ബോട്ടുകളുടെ സാന്ദ്രത + 15% സമുദ്ര സാഹചര്യങ്ങൾ.",
    confidence: "വിശ്വാസ്യത",
    provenance: "ഡാറ്റയുടെ ഉറവിടം",
    lastUpdated: "അവസാനം പുതുക്കിയത്",
    source: "നില",
    provider: "ഡാറ്റ ഉറവിടം",
    demoProvider: "സിമുലേറ്റഡ് പരിസ്ഥിതി ഡാറ്റാസെറ്റ്",
    sourceStatuses: { LIVE: "തത്സമയം", CACHED: "കാഷെ ചെയ്ത ഡാറ്റ", SIMULATED: "സിമുലേറ്റഡ്" },
    voiceAssistant: "AI സമുദ്ര ശബ്ദ സഹായി",
    microphone: "ശബ്ദ ഇൻപുട്ട് ആരംഭിക്കുക",
    ready: "തയ്യാർ",
    listening: "കേൾക്കുന്നു",
    speaking: "സംസാരിക്കുന്നു",
    voiceInputUnsupported: "ഈ ബ്രൗസറിൽ ശബ്ദ ഇൻപുട്ട് പിന്തുണയ്ക്കുന്നില്ല.",
    speechOutputUnsupported: "ശബ്ദ ഔട്ട്പുട്ട് പിന്തുണയ്ക്കുന്നില്ല; മറുപടി ടെക്സ്റ്റായി കാണിക്കുന്നു.",
    voiceError: "ശബ്ദ ഇൻപുട്ട് ആരംഭിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.",
    voiceDescription: "നിലവിലെ മത്സ്യബന്ധന സാഹചര്യങ്ങളെക്കുറിച്ച് നെയ്തലിനോട് ചോദിക്കുക.",
    suggestedQuestions: ["മത്സ്യബന്ധന സ്കോർ എത്ര?", "കടൽ സുരക്ഷിതമാണോ?", "ഏത് മത്സ്യങ്ങളാണ് സാധ്യത?", "കാറ്റിന്റെ വേഗം എത്ര?"],
    suitabilityAnswer: (score, classification, temperature, waves) =>
      `മത്സ്യബന്ധന സാധ്യത 100ൽ ${score} ആണ്. നിലവിലെ വിഭാഗീകരണം ${classification}. കടൽ താപനില ${temperature}; തിരമാല ഉയരം ${waves}.`,
    temperatureAnswer: (temperature) => `ഏറ്റവും പുതിയ സമുദ്ര ഉപരിതല താപനില ${temperature} ആണ്.`,
    windAnswer: (wind) => `ഏറ്റവും പുതിയ കാറ്റിന്റെ അളവ് ${wind} ആണ്.`,
    speciesAnswer: (species) => `സൂചിപ്പിച്ച ലക്ഷ്യ മത്സ്യ ഇനങ്ങൾ: ${species}.`,
    favorableAnswer: (score, classification) =>
      `മത്സ്യബന്ധന സാധ്യത 100ൽ ${score} ആണ്. നിലവിലെ വിഭാഗീകരണം ${classification}.`,
    simulatedWarning: "ഇത് ഒരു സിമുലേറ്റഡ് പ്രോട്ടോടൈപ്പ് വിവരമാണ്; ഔദ്യോഗിക മത്സ്യബന്ധനമോ നാവിഗേഷൻ ഉപദേശമോ ആയി കണക്കാക്കരുത്.",
    waveLevels: { calm: "ശാന്തം", moderate: "മിതമായ", rough: "പ്രക്ഷുബ്ധം" },
    languageNames: { en: "EN", ta: "தமிழ്", ml: "മലയാളം" },
    loading: "ഏകീകൃത സമുദ്ര ഇന്റലിജൻസ് ഡാറ്റ ലോഡ് ചെയ്യുന്നു…",
    unavailable: "സമുദ്ര ഇന്റലിജൻസ് ഇപ്പോൾ ലഭ്യമല്ല.",
  },
};
