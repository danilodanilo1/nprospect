import { Client, Language } from "@googlemaps/google-maps-services-js";
import Lead from "@/models/Lead";
import { connectDB } from "@/lib/db";
import { logActivity } from "@/services/activity-log.service";
import type { IngestionLeadPayload } from "@/types/ingestion";

const client = new Client({});

export interface GooglePlacesSearchParams {
  query: string;
  region?: string;
  radiusKm?: number;
}

export async function searchGooglePlaces(
  params: GooglePlacesSearchParams,
): Promise<IngestionLeadPayload[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    await logActivity(
      "warn",
      "google-places",
      "GOOGLE_PLACES_API_KEY não configurada",
    );
    return [];
  }

  await connectDB();

  const searchQuery = params.region
    ? `${params.query} em ${params.region}`
    : params.query;

  try {
    const response = await client.textSearch({
      params: {
        query: searchQuery,
        key: apiKey,
        language: Language.pt_BR,
        region: "br",
      },
    });

    const results: IngestionLeadPayload[] = [];

    for (const place of response.data.results ?? []) {
      if (!place.place_id || !place.name) continue;

      const cached = await Lead.findOne({ placeId: place.place_id }).lean();
      if (cached) continue;

      let details: IngestionLeadPayload = {
        name: place.name,
        source: "GOOGLE_PLACES",
        placeId: place.place_id,
        contacts: {
          address: place.formatted_address,
        },
        metadata: {
          google: {
            rating: place.rating,
            reviews: place.user_ratings_total,
            types: place.types,
            businessStatus: place.business_status,
          },
          opportunity: {
            score: 20,
            temperature: "COLD",
            category: "COMPANY",
            confidence: 60,
            reasons: ["Empresa encontrada em segmento-alvo no Google Places"],
            penalties: [],
            matchedPositiveTerms: [params.query],
            matchedNegativeTerms: [],
            estimatedDemand: ["cimento", "argamassa", "hidráulica", "elétrica"],
          },
        },
      };

      try {
        const detailResponse = await client.placeDetails({
          params: {
            place_id: place.place_id,
            key: apiKey,
            language: Language.pt_BR,
            fields: [
              "formatted_phone_number",
              "international_phone_number",
              "website",
              "url",
              "rating",
              "user_ratings_total",
              "business_status",
            ],
          },
        });

        const detail = detailResponse.data.result;
        details = {
          ...details,
          contacts: {
            ...details.contacts,
            phone: detail.formatted_phone_number ?? detail.international_phone_number,
            website: detail.website,
          },
          metadata: {
            ...details.metadata,
            google: {
              rating: detail.rating ?? place.rating,
              reviews: detail.user_ratings_total ?? place.user_ratings_total,
              types: place.types,
              mapsUrl: detail.url,
              businessStatus: detail.business_status ?? place.business_status,
            },
          },
        };
      } catch {
        // keep basic data from text search
      }

      results.push(details);
    }

    return results;
  } catch (error) {
    await logActivity("error", "google-places", "Falha na busca Google Places", {
      error: error instanceof Error ? error.message : "Unknown error",
      params,
    });
    return [];
  }
}
