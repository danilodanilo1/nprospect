export interface ParsedRegion {
  city?: string;
  state?: string;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Parses strings like "São Paulo, SP", "SP" or "São Paulo". */
export function parseRegion(region?: string): ParsedRegion | null {
  if (!region?.trim()) return null;

  const trimmed = region.trim();
  const commaMatch = trimmed.match(/^(.+?)\s*,\s*([A-Za-z]{2})$/);

  if (commaMatch) {
    return {
      city: commaMatch[1].trim(),
      state: commaMatch[2].toUpperCase(),
    };
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return { state: trimmed.toUpperCase() };
  }

  return { city: trimmed };
}

export function matchesRegionLocation(
  city: string | undefined,
  state: string | undefined,
  region?: string,
): boolean {
  const parsed = parseRegion(region);
  if (!parsed) return true;

  if (parsed.state) {
    if (!state || normalizeText(state) !== normalizeText(parsed.state)) {
      return false;
    }
  }

  if (parsed.city) {
    if (!city || !normalizeText(city).includes(normalizeText(parsed.city))) {
      return false;
    }
  }

  return true;
}

export function matchesRegionAddress(
  address: string | undefined,
  region?: string,
): boolean {
  const parsed = parseRegion(region);
  if (!parsed || !address) return !parsed;

  const normalizedAddress = normalizeText(address);

  if (parsed.state && !normalizedAddress.includes(normalizeText(parsed.state))) {
    return false;
  }

  if (parsed.city && !normalizedAddress.includes(normalizeText(parsed.city))) {
    return false;
  }

  return true;
}
