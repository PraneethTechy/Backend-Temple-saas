import logger from '../utils/logger.js';

export interface VisitGuidanceTempleData {
  name: string;
  city?: string;
  state?: string;
  dressCode?: string;
  parking?: string;
  guidelines?: string[];
  facilities?: string[];
}

export interface VisitGuidanceBookingData {
  bookingReference?: string;
  serviceName?: string;
  bookingDate?: string | Date;
  startTime?: string;
  endTime?: string;
}

export interface VisitGuidanceRouteData {
  originAddress?: string;
  distanceKm?: number;
  durationText?: string;
  trafficAware?: boolean;
}

export interface VisitGuidancePlanningData {
  recommendedArrivalText?: string;
  recommendedDepartureText?: string;
  explanationCallout?: string;
  departureTimeOnly?: string;
}

export interface VisitGuidanceParams {
  temple: VisitGuidanceTempleData;
  booking: VisitGuidanceBookingData;
  route: VisitGuidanceRouteData;
  planning: VisitGuidancePlanningData;
}

export interface VisitGuidanceResult {
  summary: string;
  tips: string[];
}

/**
 * Deterministic baseline tips built purely from verified database fields
 */
function buildDeterministicGuidance({ temple, booking, route, planning }: VisitGuidanceParams): VisitGuidanceResult {
  const tips: string[] = [];

  tips.push(`Start early from ${route.originAddress || 'your origin'} to accommodate route traffic.`);
  tips.push(`Carry your booking confirmation (QR code) for ${booking.serviceName || 'Darshan'}.`);
  tips.push('Keep a valid original government photo ID proof ready for all devotees.');

  if (temple.dressCode) {
    tips.push(`Follow temple dress code: ${temple.dressCode}`);
  } else {
    tips.push('Follow temple dress code (traditional attire recommended).');
  }

  if (temple.parking) {
    tips.push(`Parking advisory: ${temple.parking}`);
  }

  if (temple.facilities && temple.facilities.length > 0) {
    tips.push(`Available pilgrim facilities: ${temple.facilities.slice(0, 3).join(', ')}.`);
  }

  tips.push('Check live road and traffic conditions on the day of travel for real-time updates.');

  return {
    summary: `Your visit plan to ${temple.name} is ready 🙏 With an estimated ${route.durationText || 'travel time'} from ${route.originAddress || 'your starting location'}, your recommended departure is ${planning.departureTimeOnly || 'with sufficient buffer'} to arrive calmly before your ${booking.startTime || ''} darshan.`,
    tips,
  };
}

/**
 * OpenRouter AI Service for DevaSetu Visit Planning
 *
 * Responsibilities:
 * - Read OPENROUTER_API_KEY and OPENROUTER_MODEL from backend environment.
 * - Send verified, structured booking, temple, and route data to the LLM.
 * - Strictly forbid inventing facts, rules, timings, distances, or traffic.
 * - Provide concise, calm pilgrim visit guidance.
 * - Graceful fallback: If AI fails or key is missing, return clean fallback tips
 *   from verified database attributes without breaking the route.
 */
export const generateVisitGuidance = async ({
  temple,
  booking,
  route,
  planning,
}: VisitGuidanceParams): Promise<VisitGuidanceResult> => {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemini-2.0-flash-001';
  const siteUrl = process.env.OPENROUTER_SITE_URL || 'http://localhost:5173';
  const siteName = process.env.OPENROUTER_SITE_NAME || 'DevaSetu';

  // Build baseline verified tips directly from model data
  const fallbackGuidance = buildDeterministicGuidance({ temple, booking, route, planning });

  if (!apiKey) {
    logger.info('[OpenRouterService] No OPENROUTER_API_KEY configured. Using verified baseline guidance.');
    return fallbackGuidance;
  }

  const systemPrompt = `You are the DevaSetu Visit Planning Assistant.
Your task is to explain a temple visit plan using ONLY verified information supplied in the user prompt.
Never invent temple facts, routes, distances, timings, prices, facilities, traffic, or booking information.
Distance and travel duration come from Google Maps.
Arrival and departure recommendations come from the DevaSetu planning engine.

Your job is to:
1. Summarize the journey warmly and respectfully in 1-2 sentences.
2. Provide 4-6 concise, practical reminders as bullet points strictly based on the supplied temple guidelines, dress code, facilities, parking, and booking details.
3. Keep the tone calm, devotional, and practical.
4. Output valid JSON in the format:
{
  "summary": "...",
  "tips": [
    "...",
    "..."
  ]
}`;

  const userPayload = {
    temple: {
      name: temple.name,
      city: temple.city,
      state: temple.state,
      dressCode: temple.dressCode || 'Traditional attire recommended.',
      parking: temple.parking || '',
      guidelines: temple.guidelines || [],
      facilities: temple.facilities || [],
    },
    booking: {
      bookingReference: booking.bookingReference,
      serviceName: booking.serviceName,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
    route: {
      originAddress: route.originAddress,
      distanceKm: route.distanceKm,
      durationText: route.durationText,
      trafficAware: route.trafficAware,
    },
    planning: {
      recommendedArrivalText: planning.recommendedArrivalText,
      recommendedDepartureText: planning.recommendedDepartureText,
      explanationCallout: planning.explanationCallout,
    },
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': siteName,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn(`[OpenRouterService] API responded with ${response.status}: ${errText}`);
      return fallbackGuidance;
    }

    interface OpenRouterChoice {
      message?: {
        content?: string;
      };
    }

    const data = (await response.json()) as { choices?: OpenRouterChoice[] };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return fallbackGuidance;
    }

    let parsed: { summary?: string; tips?: unknown[] } | undefined;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Regex extraction if response contains markdown codeblock
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    }

    if (parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.tips)) {
      return {
        summary: parsed.summary.trim(),
        tips: parsed.tips.map((t) => String(t).trim()).filter(Boolean),
      };
    }

    return fallbackGuidance;
  } catch (error: unknown) {
    const err = error as { message?: string };
    logger.warn(`[OpenRouterService] Error generating guidance: ${err.message || 'Unknown error'}. Returning verified baseline.`);
    return fallbackGuidance;
  }
};

export default {
  generateVisitGuidance,
};
