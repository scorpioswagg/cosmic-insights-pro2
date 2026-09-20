export interface GeocodeResult {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/**
 * Open-Meteo geocoding API — no key required.
 * https://open-meteo.com/en/docs/geocoding-api
 */
export async function geocodePlace(query: string): Promise<GeocodeResult[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const json = (await res.json()) as {
    results?: Array<{
      name: string; country: string; admin1?: string;
      latitude: number; longitude: number; timezone: string;
    }>;
  };
  return (json.results ?? []).map((r) => ({
    name: r.name, country: r.country, admin1: r.admin1,
    latitude: r.latitude, longitude: r.longitude, timezone: r.timezone,
  }));
}