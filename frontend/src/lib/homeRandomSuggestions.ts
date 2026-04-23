// Random "DJ + adjective" display names and party name ideas for the Home create/join forms

const DJ_ADJECTIVES = [
  'Cosmic', 'Neon', 'Velvet', 'Electric', 'Solar', 'Lunar', 'Golden', 'Midnight', 'Frost', 'Prime',
  'Hyper', 'Deep', 'Wild', 'Smooth', 'Crisp', 'Vivid', 'Astral', 'Crystal', 'Crimson', 'Azure',
  'Ruby', 'Mellow', 'Funky', 'Groovy', 'Spicy', 'Icy', 'Misty', 'Bold', 'Swift', 'Noble',
] as const;

const PARTY_IDEAS = [
  'Friday Night Bangers',
  'The Velvet Session',
  'Midnight Voltage',
  'Saturday After Hours',
  'Electric Garden',
  'Late Night Rotation',
  'The Banger Bracket',
  'Crate Diggers Anonymous',
  'Squad Goals & Turntables',
  'Afterglow Jams',
  'Weekend Warfare',
  'The Heat Check',
  'Vinyl & Chill',
  'The Mixtape Mafia',
  'Sunset Serenade',
  'Basement Bounce',
  'Rooftop Rumble',
  'The Sound Off',
  'All Hands on Deck',
  'Playlist Thunderdome',
  'Crown the Track',
  'The Verdict Room',
  'Turntable Tussle',
  'Golden Hour Grooves',
  'The Wild Card',
  'Audio Arena',
  'No Skips Zone',
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Display name: always `DJ` + a capitalized adjective. */
export function randomDjDisplayName(): string {
  return `DJ ${pick(DJ_ADJECTIVES)}`;
}

export function randomPartyIdea(): string {
  return pick(PARTY_IDEAS);
}
