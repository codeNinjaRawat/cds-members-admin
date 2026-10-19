/**
 * Photos used across the admin – one place that says which picture belongs to which screen.
 * All are Pexels photos (free license: any use, no credit required – https://www.pexels.com/license/).
 * Each has a LOCAL file (admin/public/img/<key>.jpg, fetched once with `node tools/get-images.mjs`) and the Pexels
 * address as the fallback while the local copy is missing, so screens never show a hole. No people are named.
 */
export type PhotoKey = keyof typeof PHOTOS;
export const PHOTOS = {
  // backgrounds
  'mosque-arches': { id: 31779457, alt: 'Rows of striped arches inside a historic mosque', tone: 'warm' },
  'mosque-hall': { id: 33276338, alt: 'Prayer hall of a modern mosque, lit chandeliers', tone: 'warm' },
  'mosque-nabawi': { id: 19042364, alt: 'Columns and carpets inside a large mosque', tone: 'warm' },
  'ceiling-geometric': { id: 35609785, alt: 'Geometric ceiling with calligraphy', tone: 'cool' },
  'ceiling-patterns': { id: 31906242, alt: 'Mosque ceiling with Islamic patterns', tone: 'cool' },
  'tile-mosaic': { id: 31085604, alt: 'Blue tile mosaic', tone: 'cool' },
  'minarets-sunset': { id: 33410161, alt: 'Minarets against a sunset sky', tone: 'warm' },
  'mosque-sunset': { id: 25022235, alt: 'Sunset over a mosque', tone: 'warm' },
  'mosque-moon': { id: 13592039, alt: 'The moon behind a mosque', tone: 'cool' },
  'mosque-night': { id: 17911120, alt: 'A mosque tower at night with a crescent moon', tone: 'cool' },
  'houston-skyline': { id: 10893475, alt: 'Houston high-rises under a cloudy sky', tone: 'cool' },
  'houston-night': { id: 14177239, alt: 'Houston streets at night', tone: 'cool' },
  // module pictures
  'congregation': { id: 31343648, alt: 'A large group praying in a mosque courtyard', tone: 'warm' },
  'friday-prayer': { id: 36853542, alt: 'Friday prayer in a mosque', tone: 'warm' },
  'praying-crowd': { id: 12049037, alt: 'A crowd praying together', tone: 'warm' },
  'iftar': { id: 20475941, alt: 'People sharing dinner during Ramadan', tone: 'warm' },
  'dates': { id: 7249766, alt: 'A bowl of dates on a table', tone: 'warm' },
  'quran-dark': { id: 12039704, alt: 'Open pages of the Quran on a black background', tone: 'cool' },
  'quran-open': { id: 6873767, alt: 'An open Quran', tone: 'warm' },
  'ballot': { id: 1550337, alt: 'A person dropping a ballot into a box', tone: 'cool' },
  'ballot-hand': { id: 5935742, alt: 'A hand casting a vote', tone: 'cool' },
  'meeting': { id: 7793927, alt: 'People discussing in a conference room', tone: 'cool' },
  'meeting-table': { id: 3183186, alt: 'People in a meeting around a table', tone: 'cool' },
  'calculator': { id: 8297220, alt: 'Working on documents with a calculator', tone: 'cool' },
  'ledger': { id: 33175649, alt: 'A financial document on a desk', tone: 'cool' },
  'envelopes': { id: 1906606, alt: 'Letter envelopes', tone: 'warm' },
  'coins': { id: 7118211, alt: 'Coins being gathered', tone: 'warm' },
  'desk-laptop': { id: 15555858, alt: 'A desk with a laptop and a monitor showing a website', tone: 'cool' },
  'store-shelves': { id: 12280949, alt: 'Foods on wooden shelves in a store', tone: 'warm' },
  'map-pin': { id: 7663519, alt: 'A hand placing a pin on a map', tone: 'cool' },
  'family': { id: 10505889, alt: 'A family portrait', tone: 'warm' },
  'market-night': { id: 26564364, alt: 'An illuminated market at night', tone: 'warm' },
} as const satisfies Record<string, { id: number; alt: string; tone: 'warm' | 'cool' }>;

export const localSrc = (k: PhotoKey) => `/img/${k}.jpg`;
export const remoteSrc = (k: PhotoKey, w = 1800) => `https://images.pexels.com/photos/${PHOTOS[k].id}/pexels-photo-${PHOTOS[k].id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/** Which photo belongs to which part of the admin (section = the sidebar group). */
export const SECTION_ART: Record<string, PhotoKey> = {
  Overview: 'minarets-sunset',
  Members: 'congregation', 'Work queues': 'ledger', Communication: 'envelopes', 'Membership rules': 'quran-open',
  'Masjids and zones': 'map-pin', 'Prayer times': 'mosque-moon', Events: 'iftar',
  'Zakat and Sadaqah': 'dates', Donations: 'coins', Fundraising: 'market-night', Finance: 'calculator', 'Member benefits': 'store-shelves',
  'Elected officials': 'meeting-table', 'Meetings and minutes': 'meeting', Elections: 'ballot',
  Website: 'desk-laptop', 'Giving page': 'quran-dark', Reports: 'ceiling-patterns', Settings: 'houston-night', 'Coming next': 'tile-mosaic',
  'Family trees': 'family',
};
/** Photo wallpapers offered in My appearance. */
export const WALL_PHOTOS: Record<string, PhotoKey> = { arches: 'mosque-arches', ceiling: 'ceiling-geometric', mosaic: 'tile-mosaic', skyline: 'houston-skyline', moon: 'mosque-night', dusk: 'houston-night' };
