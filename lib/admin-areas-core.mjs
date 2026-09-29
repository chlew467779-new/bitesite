const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keysAllowed(value, allowed) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function boundedText(value, label, max) {
  if (typeof value !== 'string') throw new Error(`${label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) throw new Error(`${label} must be 1–${max} characters`);
  return trimmed;
}

function parseAliases(value) {
  if (!Array.isArray(value) || value.length > 10) throw new Error('Aliases must be a list of at most 10 names');
  const aliases = value.map((alias) => boundedText(alias, 'Alias', 40));
  if (new Set(aliases.map((alias) => alias.toLocaleLowerCase())).size !== aliases.length) {
    throw new Error('Aliases must be unique');
  }
  return aliases;
}

export function parseCreateArea(value) {
  if (!object(value) || !keysAllowed(value, ['state', 'name', 'aliases'])) throw new Error('Invalid area fields');
  const state = boundedText(value.state, 'State', 60);
  const name = boundedText(value.name, 'Name', 80);
  const aliases = parseAliases(value.aliases ?? []);
  if (aliases.some((alias) => alias.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error('An alias cannot repeat the area name');
  }
  return { country: 'MY', state, name, aliases };
}

export function parsePatchArea(value) {
  if (!object(value) || !keysAllowed(value, ['id', 'aliases', 'is_active']) ||
      typeof value.id !== 'string' || !uuidPattern.test(value.id) ||
      (!Object.hasOwn(value, 'aliases') && !Object.hasOwn(value, 'is_active'))) {
    throw new Error('Invalid area update fields');
  }
  const patch = {};
  if (Object.hasOwn(value, 'aliases')) patch.aliases = parseAliases(value.aliases);
  if (Object.hasOwn(value, 'is_active')) {
    if (typeof value.is_active !== 'boolean') throw new Error('is_active must be true or false');
    patch.is_active = value.is_active;
  }
  return { id: value.id, patch };
}

export function findAreaConflict(candidate, areas, excludedId = null) {
  const names = [candidate.name, ...candidate.aliases].filter(Boolean).map((name) => name.toLocaleLowerCase());
  for (const area of areas) {
    if (area.id === excludedId) continue;
    if (names.includes(area.name.toLocaleLowerCase())) return area.name;
  }
  return null;
}
