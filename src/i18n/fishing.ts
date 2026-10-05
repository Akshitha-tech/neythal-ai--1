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
  classification: string;
  advisory: string;
  advisoryMessage: string;
  advisoryDescription: string;
  parameters: string;
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
  targetSpecies: string;
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
  listeningPrompt: string;
  suitabilityAnswer: (score: number, classification: string, temperature: string, waves: string) => string;
  temperatureAnswer: (temperature: string) => string;
  windAnswer: (wind: string) => string;
  speciesAnswer: (species: string) => string;
  favorableAnswer: (score: number, classification: string) => string;
  simulatedWarning: string;
  riskLevels: Record<"LOW" | "MODERATE" | "HIGH" | "CRITICAL", string>;
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
    footerModel: "AI MODEL / ONLINE",
    footerRegion: "TAMIL NADU DEEP-SEA FISHERIES",
    score: "FISHING SUITABILITY SCORE",
    classification: "CLASSIFICATION",
    advisory: "AI MARINE ADVISORY",
    advisoryMessage: "Fishing conditions are favorable in this region.",
    advisoryDescription: "Assessment based on the latest normalized environmental and fishing activity data.",
    parameters: "ENVIRONMENTAL PARAMETERS",
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
    targetSpecies: "Target species",
    scoreBreakdown: "SCORE BREAKDOWN",
    vesselActivity: "Vessel activity",
    historicalActivity: "Historical fishing activity",
    environmentalSuitability: "Environmental suitability",
    vesselDensity: "Vessel density",
    oceanConditions: "Ocean conditions",
    methodology: "Calculation methodology",
    methodologyText: "30% vessel activity + 20% historical fishing activity + 20% environmental suitability + 15% vessel density + 15% ocean conditions.",
    confidence: "Confidence",
    provenance: "DATA PROVENANCE",
    lastUpdated: "Last updated",
    source: "Status",
    provider: "Source",
    demoProvider: "Deterministic demo dataset",
    sourceStatuses: { LIVE: "LIVE", CACHED: "CACHED", SIMULATED: "SIMULATED" },
    voiceAssistant: "AI MARINE VOICE ASSISTANT",
    microphone: "Start voice input",
    ready: "READY",
    listening: "LISTENING",
    speaking: "SPEAKING",
    voiceInputUnsupported: "Voice input is not supported in this browser.",
    speechOutputUnsupported: "Speech output is not supported; the response is shown as text.",
    voiceError: "Voice input could not be started. Please try again.",
    listeningPrompt: "Ask about suitability, sea temperature, wind, or indicated species.",
    suitabilityAnswer: (score, classification, temperature, waves) =>
      `Fishing suitability is ${score} out of 100. The current classification is ${classification}. Sea temperature is ${temperature} and wave height is ${waves}.`,
    temperatureAnswer: (temperature) => `The latest sea surface temperature is ${temperature}.`,
    windAnswer: (wind) => `The latest wind reading is ${wind}.`,
    speciesAnswer: (species) => `The indicated target species are ${species}.`,
    favorableAnswer: (score, classification) =>
      `Fishing suitability is ${score} out of 100, classified as ${classification}.`,
    simulatedWarning: "This is simulated prototype intelligence and is not official fishing or navigation advice.",
    riskLevels: { LOW: "Low", MODERATE: "Moderate", HIGH: "High", CRITICAL: "Critical" },
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
    footerModel: "AI மாதிரி / இணையத்தில்",
    footerRegion: "தமிழ்நாடு ஆழ்கடல் மீன்பிடி",
    score: "மீன்பிடி திறன் மதிப்பெண்",
    classification: "வகைப்பாடு",
    advisory: "AI கடல் ஆலோசனை",
    advisoryMessage: "இந்த பகுதியில் மீன்பிடிக்க மிகவும் ஏற்ற சூழ்நிலை உள்ளது.",
    advisoryDescription: "சமீபத்திய ஒருங்கிணைக்கப்பட்ட சுற்றுச்சூழல் மற்றும் மீன்பிடி செயல்பாட்டுத் தரவின் அடிப்படையிலான மதிப்பீடு.",
    parameters: "சுற்றுச்சூழல் அளவுருக்கள்",
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
    targetSpecies: "இலக்கு மீன் இனங்கள்",
    scoreBreakdown: "மதிப்பெண் விவரம்",
    vesselActivity: "படகு செயல்பாடு",
    historicalActivity: "வரலாற்று மீன்பிடி செயல்பாடு",
    environmentalSuitability: "சுற்றுச்சூழல் ஏற்றத்தன்மை",
    vesselDensity: "படகு அடர்த்தி",
    oceanConditions: "கடல் நிலைமைகள்",
    methodology: "கணக்கீட்டு முறை",
    methodologyText: "30% படகு செயல்பாடு + 20% வரலாற்று மீன்பிடி செயல்பாடு + 20% சுற்றுச்சூழல் ஏற்றத்தன்மை + 15% படகு அடர்த்தி + 15% கடல் நிலைமைகள்.",
    confidence: "நம்பகத்தன்மை",
    provenance: "தரவு மூலம்",
    lastUpdated: "கடைசியாக புதுப்பிக்கப்பட்டது",
    source: "நிலை",
    provider: "தரவு மூலம்",
    demoProvider: "நிலையான மாதிரி தரவுத்தொகுப்பு",
    sourceStatuses: { LIVE: "நேரடி", CACHED: "சேமிக்கப்பட்டது", SIMULATED: "மாதிரி தரவு" },
    voiceAssistant: "AI கடல் குரல் உதவியாளர்",
    microphone: "குரல் உள்ளீட்டைத் தொடங்கு",
    ready: "தயார்",
    listening: "கேட்கிறது",
    speaking: "பேசுகிறது",
    voiceInputUnsupported: "இந்த உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை.",
    speechOutputUnsupported: "குரல் வெளியீடு ஆதரிக்கப்படவில்லை; பதில் உரையாகக் காட்டப்படுகிறது.",
    voiceError: "குரல் உள்ளீட்டைத் தொடங்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
    listeningPrompt: "மீன்பிடி திறன், கடல் வெப்பநிலை, காற்று அல்லது மீன் இனங்கள் பற்றி கேளுங்கள்.",
    suitabilityAnswer: (score, classification, temperature, waves) =>
      `மீன்பிடி திறன் 100-ல் ${score} மதிப்பெண்கள். தற்போதைய வகைப்பாடு ${classification}. கடல் வெப்பநிலை ${temperature}; அலை உயரம் ${waves}.`,
    temperatureAnswer: (temperature) => `சமீபத்திய கடல் மேற்பரப்பு வெப்பநிலை ${temperature}.`,
    windAnswer: (wind) => `சமீபத்திய காற்று அளவீடு ${wind}.`,
    speciesAnswer: (species) => `குறிப்பிடப்பட்ட இலக்கு மீன் இனங்கள்: ${species}.`,
    favorableAnswer: (score, classification) =>
      `மீன்பிடி திறன் 100-ல் ${score} மதிப்பெண்கள். தற்போதைய வகைப்பாடு ${classification}.`,
    simulatedWarning: "இது ஒரு மாதிரி செயற்கை நுண்ணறிவு தரவு மட்டுமே; அதிகாரப்பூர்வ மீன்பிடி அல்லது வழிசெலுத்தல் ஆலோசனையாக கருத வேண்டாம்.",
    riskLevels: {
      LOW: "குறைந்த மீன்பிடி திறன்",
      MODERATE: "மிதமான மீன்பிடி திறன்",
      HIGH: "உயர்ந்த மீன்பிடி திறன்",
      CRITICAL: "மிக அதிக மீன்பிடி திறன்",
    },
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
    footerModel: "AI മാതൃക / ഓൺലൈൻ",
    footerRegion: "തമിഴ്നാട് ആഴക്കടൽ മത്സ്യബന്ധനം",
    score: "മത്സ്യബന്ധന അനുയോജ്യതാ സ്കോർ",
    classification: "വിഭാഗീകരണം",
    advisory: "AI സമുദ്ര ഉപദേശം",
    advisoryMessage: "ഈ പ്രദേശത്ത് മത്സ്യബന്ധനത്തിന് വളരെ അനുകൂലമായ സാഹചര്യങ്ങളാണ് നിലവിലുള്ളത്.",
    advisoryDescription: "ഏറ്റവും പുതിയ ഏകീകൃത പരിസ്ഥിതി, മത്സ്യബന്ധന പ്രവർത്തന ഡാറ്റയെ അടിസ്ഥാനമാക്കിയുള്ള വിലയിരുത്തൽ.",
    parameters: "പരിസ്ഥിതി ഘടകങ്ങൾ",
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
    targetSpecies: "ലക്ഷ്യ മത്സ്യ ഇനങ്ങൾ",
    scoreBreakdown: "സ്കോർ വിശദാംശങ്ങൾ",
    vesselActivity: "ബോട്ടുകളുടെ പ്രവർത്തനം",
    historicalActivity: "ചരിത്രപരമായ മത്സ്യബന്ധന പ്രവർത്തനം",
    environmentalSuitability: "പരിസ്ഥിതി അനുയോജ്യത",
    vesselDensity: "ബോട്ടുകളുടെ സാന്ദ്രത",
    oceanConditions: "സമുദ്ര സാഹചര്യങ്ങൾ",
    methodology: "കണക്കുകൂട്ടൽ രീതി",
    methodologyText: "30% ബോട്ടുകളുടെ പ്രവർത്തനം + 20% ചരിത്രപരമായ മത്സ്യബന്ധനം + 20% പരിസ്ഥിതി അനുയോജ്യത + 15% ബോട്ടുകളുടെ സാന്ദ്രത + 15% സമുദ്ര സാഹചര്യങ്ങൾ.",
    confidence: "വിശ്വാസ്യത",
    provenance: "ഡാറ്റയുടെ ഉറവിടം",
    lastUpdated: "അവസാനം പുതുക്കിയത്",
    source: "നില",
    provider: "ഡാറ്റ ഉറവിടം",
    demoProvider: "നിശ്ചിത സിമുലേറ്റഡ് ഡാറ്റാസെറ്റ്",
    sourceStatuses: { LIVE: "തത്സമയം", CACHED: "കാഷെ ചെയ്ത ഡാറ്റ", SIMULATED: "സിമുലേറ്റഡ്" },
    voiceAssistant: "AI സമുദ്ര ശബ്ദ സഹായി",
    microphone: "ശബ്ദ ഇൻപുട്ട് ആരംഭിക്കുക",
    ready: "തയ്യാർ",
    listening: "കേൾക്കുന്നു",
    speaking: "സംസാരിക്കുന്നു",
    voiceInputUnsupported: "ഈ ബ്രൗസറിൽ ശബ്ദ ഇൻപുട്ട് പിന്തുണയ്ക്കുന്നില്ല.",
    speechOutputUnsupported: "ശബ്ദ ഔട്ട്പുട്ട് പിന്തുണയ്ക്കുന്നില്ല; മറുപടി ടെക്സ്റ്റായി കാണിക്കുന്നു.",
    voiceError: "ശബ്ദ ഇൻപുട്ട് ആരംഭിക്കാനായില്ല. വീണ്ടും ശ്രമിക്കുക.",
    listeningPrompt: "മത്സ്യബന്ധന സാധ്യത, കടൽ താപനില, കാറ്റ്, അല്ലെങ്കിൽ മത്സ്യ ഇനങ്ങൾ ചോദിക്കുക.",
    suitabilityAnswer: (score, classification, temperature, waves) =>
      `മത്സ്യബന്ധന സാധ്യത 100ൽ ${score} ആണ്. നിലവിലെ വിഭാഗീകരണം ${classification}. കടൽ താപനില ${temperature}; തിരമാല ഉയരം ${waves}.`,
    temperatureAnswer: (temperature) => `ഏറ്റവും പുതിയ സമുദ്ര ഉപരിതല താപനില ${temperature} ആണ്.`,
    windAnswer: (wind) => `ഏറ്റവും പുതിയ കാറ്റിന്റെ അളവ് ${wind} ആണ്.`,
    speciesAnswer: (species) => `സൂചിപ്പിച്ച ലക്ഷ്യ മത്സ്യ ഇനങ്ങൾ: ${species}.`,
    favorableAnswer: (score, classification) =>
      `മത്സ്യബന്ധന സാധ്യത 100ൽ ${score} ആണ്. നിലവിലെ വിഭാഗീകരണം ${classification}.`,
    simulatedWarning: "ഇത് ഒരു സിമുലേറ്റഡ് പ്രോട്ടോടൈപ്പ് വിവരമാണ്; ഔദ്യോഗിക മത്സ്യബന്ധനമോ നാവിഗേഷൻ ഉപദേശമോ ആയി കണക്കാക്കരുത്.",
    riskLevels: {
      LOW: "കുറഞ്ഞ മത്സ്യബന്ധന സാധ്യത",
      MODERATE: "മിതമായ മത്സ്യബന്ധന സാധ്യത",
      HIGH: "ഉയർന്ന മത്സ്യബന്ധന സാധ്യത",
      CRITICAL: "വളരെ ഉയർന്ന മത്സ്യബന്ധന സാധ്യത",
    },
    waveLevels: { calm: "ശാന്തം", moderate: "മിതമായ", rough: "പ്രക്ഷുബ്ധം" },
    languageNames: { en: "EN", ta: "தமிழ്", ml: "മലയാളം" },
    loading: "ഏകീകൃത സമുദ്ര ഇന്റലിജൻസ് ഡാറ്റ ലോഡ് ചെയ്യുന്നു…",
    unavailable: "സമുദ്ര ഇന്റലിജൻസ് ഇപ്പോൾ ലഭ്യമല്ല.",
  },
};
