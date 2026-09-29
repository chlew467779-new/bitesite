import { discoveryGroups, merchantArea } from './discovery-core.mjs';

export function hasMapCoordinates(merchant) {
  return typeof merchant?.latitude === 'number' && Number.isFinite(merchant.latitude) &&
    merchant.latitude >= -90 && merchant.latitude <= 90 &&
    typeof merchant?.longitude === 'number' && Number.isFinite(merchant.longitude) &&
    merchant.longitude >= -180 && merchant.longitude <= 180;
}

/** Build only choices with a public restaurant that can actually appear on the map. */
export function mapDiscoveryOptions(merchants, areas) {
  const mapped = merchants.filter(hasMapCoordinates);
  const knownAreas = new Set(areas.map((area) => area.name.toLocaleLowerCase()));
  const areaNames = new Set();
  for (const merchant of mapped) {
    const area = merchantArea(merchant);
    if (area && (knownAreas.size === 0 || knownAreas.has(area.toLocaleLowerCase()))) areaNames.add(area);
  }
  return {
    mapped,
    missingCount: merchants.length - mapped.length,
    cuisines: discoveryGroups('cuisine', mapped).map((group) => group.label),
    areas: [...areaNames].sort((a, b) => a.localeCompare(b)),
  };
}
