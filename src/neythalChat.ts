export type ChatIntent =
  | "BOUNDARY"
  | "SEA"
  | "FISHING"
  | "WEATHER"
  | "HELP"
  | "UNKNOWN";

export type ChatResponse = {
  text: string;
  tamil: string;
};

export function detectIntent(
  message: string
): ChatIntent {

  const text = message.toLowerCase();

  if (
    text.includes("boundary") ||
    text.includes("border") ||
    text.includes("limit") ||
    text.includes("near border") ||
    text.includes("geofence") ||
    text.includes("imbl")
  ) {
    return "BOUNDARY";
  }

  if (
    text.includes("sea") ||
    text.includes("wave") ||
    text.includes("ocean") ||
    text.includes("condition")
  ) {
    return "SEA";
  }

  if (
    text.includes("fish") ||
    text.includes("fishing") ||
    text.includes("catch") ||
    text.includes("meen")
  ) {
    return "FISHING";
  }

  if (
    text.includes("weather") ||
    text.includes("wind") ||
    text.includes("rain") ||
    text.includes("storm")
  ) {
    return "WEATHER";
  }

  if (
    text.includes("help") ||
    text.includes("what can you do") ||
    text.includes("enna panna")
  ) {
    return "HELP";
  }

  return "UNKNOWN";
}


export function getChatResponse(
  message: string,
  safetyZone: string
): ChatResponse {

  const intent = detectIntent(message);

  switch (intent) {

    case "BOUNDARY":

      if (safetyZone === "CRITICAL") {
        return {
          text:
            "You are currently in a critical maritime safety zone. Move away from the boundary immediately.",
          tamil:
            "Boundary-ku romba dangerous-aa close-la irukeenga. Udane safe side-ku thirumbi ponga.",
        };
      }

      if (safetyZone === "WARNING") {
        return {
          text:
            "You are approaching the maritime boundary. Please change course toward the safe navigation area.",
          tamil:
            "Boundary pakkathula vandhutteenga. Safe side-ku konjam thirumbi ponga.",
        };
      }

      if (safetyZone === "CAUTION") {
        return {
          text:
            "You are getting closer to the maritime boundary. Continue with caution.",
          tamil:
            "Boundary-kku konjam close-aa irukeenga. Careful-aa continue pannunga.",
        };
      }

      return {
        text:
          "Your vessel is currently inside the monitored safe navigation area.",
        tamil:
          "Ippo unga boat safe navigation area-kulla irukku.",
      };


    case "SEA":

      return {
        text:
          "Current sea conditions are moderate. Wave height is around 1.8 metres.",
        tamil:
          "Ippo sea condition moderate-aa irukku. Wave height approximately 1.8 metres.",
      };


    case "FISHING":

      return {
        text:
          "Current fishing suitability is high, with a prototype score of 88 out of 100.",
        tamil:
          "Ippo fishing conditions nalla irukku. Suitability score 88 out of 100.",
      };


    case "WEATHER":

      return {
        text:
          "Current wind conditions are around 18 kilometres per hour. Continue monitoring weather changes.",
        tamil:
          "Ippo wind speed around 18 kilometres per hour. Weather change-a monitor pannitu irunga.",
      };


    case "HELP":

      return {
        text:
          "I can help you with boundary safety, sea conditions, fishing conditions and weather.",
        tamil:
          "Boundary safety, sea condition, fishing condition, weather pathi naan help panna mudiyum.",
      };


    default:

      return {
        text:
          "I can help with maritime safety, sea conditions, fishing and weather. Try asking me one of these.",
        tamil:
          "Maritime safety, sea condition, fishing illa weather pathi kelunga. Naan help panren.",
      };
  }
}