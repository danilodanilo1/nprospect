export interface ParsedRegion {
  state?: string;
  city?: string;
  /** When false, only the state (UF) is enforced. */
  requireCity?: boolean;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isSaoPauloStateAlias(city: string, state: string): boolean {
  return normalizeText(city) === "sao paulo" && state.toUpperCase() === "SP";
}

/** Parses strings like "São Paulo, SP", "SP" or "Campinas, SP". */
export function parseRegion(region?: string): ParsedRegion | null {
  if (!region?.trim()) return null;

  const trimmed = region.trim();
  const commaMatch = trimmed.match(/^(.+?)\s*,\s*([A-Za-z]{2})$/);

  if (commaMatch) {
    const city = commaMatch[1].trim();
    const state = commaMatch[2].toUpperCase();

    return {
      city,
      state,
      requireCity: !isSaoPauloStateAlias(city, state),
    };
  }

  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    return { state: trimmed.toUpperCase() };
  }

  if (normalizeText(trimmed) === "sao paulo") {
    return { state: "SP", city: trimmed, requireCity: false };
  }

  return { city: trimmed, requireCity: true };
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

  if (parsed.city && parsed.requireCity !== false) {
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
  if (!parsed) return true;
  if (!address) return false;

  const normalizedAddress = normalizeText(address);

  if (parsed.state) {
    const stateToken = normalizeText(parsed.state);
    const hasState =
      normalizedAddress.endsWith(`- ${stateToken}`) ||
      normalizedAddress.includes(` ${stateToken}`) ||
      normalizedAddress.includes(`- ${stateToken}`);

    if (!hasState) return false;
  }

  if (parsed.city && parsed.requireCity !== false) {
    if (!normalizedAddress.includes(normalizeText(parsed.city))) {
      return false;
    }
  }

  return true;
}

export function getRegionLabel(region?: string): string {
  const parsed = parseRegion(region);
  if (!parsed) return "Brasil";

  if (parsed.state && parsed.requireCity === false) {
    return parsed.state === "SP" ? "Estado de São Paulo" : parsed.state;
  }

  if (parsed.city && parsed.state) {
    return `${parsed.city}, ${parsed.state}`;
  }

  return parsed.city ?? parsed.state ?? region ?? "Brasil";
}
