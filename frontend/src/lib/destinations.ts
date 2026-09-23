export type Category = "all" | "nature" | "culture" | "spiritual";
export type Region = "all" | "india" | "international";
export type Destination = {
  id: string; name: string; country: string; image: string; alt: string;
  mood: string; description: string; categories: Category[];
  places: string[]; coordinates: [number, number]; accent: string;
};

export const destinations: Destination[] = [
  {
    id: "jammu", name: "Jammu", country: "India", image: "/images/jammu.jpg",
    alt: "Hari Niwas Palace in Jammu", mood: "Palaces, hills and sacred journeys", accent: "#F3C58D",
    description: "Discover Jammu's palaces and temples, with the hills of the region beyond the city.",
    categories: ["culture", "spiritual"], places: ["Hari Niwas Palace", "Raghunath Temple", "Bahu Fort"], coordinates: [32.7266, 74.857],
  },
  {
    id: "darjeeling", name: "Darjeeling", country: "India", image: "/images/darjeeling.jpg",
    alt: "Darjeeling Himalayan Railway train beside a local fruit shop", mood: "Hill-town days, Himalayan horizons", accent: "#B6DDA7",
    description: "Follow the Himalayan Railway through a hill town known for tea and mountain views.",
    categories: ["nature", "culture"], places: ["Darjeeling Himalayan Railway", "Tiger Hill", "Batasia Loop"], coordinates: [27.041, 88.2663],
  },
  {
    id: "varkala", name: "Varkala", country: "India", image: "/images/varkala.jpg",
    alt: "Varkala beach and coastal cliffs in Kerala", mood: "Cliffside mornings, seaside sunsets", accent: "#A8E4E1",
    description: "A Kerala coastal escape where cliffs overlook the Arabian Sea and the beach sets the pace.",
    categories: ["nature", "spiritual"], places: ["Varkala Beach", "Varkala Cliff", "Janardanaswamy Temple"], coordinates: [8.7379, 76.7163],
  },
  {
    id: "goa", name: "Goa", country: "India", image: "/images/goa.jpg",
    alt: "Visitors enjoying a beach in Goa", mood: "Salt air and a slower rhythm", accent: "#F4B6CF",
    description: "Explore Goa's beaches, historic neighbourhoods and churches, from the coast to the streets of Panaji.",
    categories: ["nature", "culture", "spiritual"], places: ["Panaji", "Fontainhas", "Basilica of Bom Jesus"], coordinates: [15.4909, 73.8278],
  },
  {
    id: "bali", name: "Bali", country: "Indonesia", image: "/images/bali.jpg",
    alt: "Balinese temple beside a lake, with mountains in the distance",
    mood: "A little closer to paradise", accent: "#F5C4A0",
    description: "Temple courtyards, green terraces, and days that move a little slower. Find your own rhythm between Bali's coast and its quieter interior.",
    categories: ["nature", "spiritual"], places: ["Ulun Danu Beratan Temple", "Ubud", "Tegallalang Rice Terraces"],
    coordinates: [-8.4095, 115.1889],
  },
  {
    id: "kyoto", name: "Kyoto", country: "Japan", image: "/images/kyoto.jpg",
    alt: "Kyoto's Yasaka Pagoda above a traditional street at dusk",
    mood: "Old-world soul. New discoveries.", accent: "#F3B9CC",
    description: "Follow lantern-lit lanes, pause in a temple garden, and discover a city where everyday rituals hold extraordinary beauty.",
    categories: ["culture", "spiritual"], places: ["Higashiyama", "Kiyomizu-dera", "Arashiyama"],
    coordinates: [35.0116, 135.7681],
  },
  {
    id: "agra", name: "Agra", country: "India", image: "/images/agra.jpg",
    alt: "The white marble Taj Mahal framed by its gardens in Agra",
    mood: "A love letter in marble", accent: "#C9C3F8",
    description: "Meet the marble silhouette that needs no introduction, then venture into Mughal gardens, red sandstone courtyards, and the city's living craft traditions.",
    categories: ["culture", "spiritual"], places: ["Taj Mahal", "Agra Fort", "Mehtab Bagh"],
    coordinates: [27.1767, 78.0081],
  },
  {
    id: "cinque-terre", name: "Cinque Terre", country: "Italy", image: "/images/cinque-terre.jpg",
    alt: "Colourful village buildings overlooking the sea in Cinque Terre",
    mood: "Take the scenic route", accent: "#B5DFE3",
    description: "Five coastal villages, colourful harbours, and the Ligurian Sea. Linger over a waterfront lunch or explore the paths between villages.",
    categories: ["nature", "culture", "spiritual"], places: ["Manarola", "Vernazza", "Church of San Giovanni Battista, Monterosso"],
    coordinates: [44.1461, 9.6439],
  },
  {
    id: "iceland", name: "South Iceland", country: "Iceland", image: "/images/iceland.jpg",
    alt: "A waterfall surrounded by Iceland's green landscape",
    mood: "Wild, in the best way", accent: "#C7E5AE",
    description: "Waterfalls, volcanic landscapes, and wide-open horizons. Follow the south coast and let the landscape set the pace.",
    categories: ["nature"], places: ["Skogafoss", "Vik", "Seljalandsfoss"],
    coordinates: [63.5321, -19.5114],
  },
];

export const pilgrimagePlaces = [
  { id: "vaishno-devi", name: "Vaishno Devi", location: "Katra, Jammu & Kashmir", query: "Vaishno Devi Temple, Katra, India", image: "/images/vaishno-devi.jpg", alt: "Vaishno Devi shrine surrounded by snow" },
  { id: "kashi", name: "Kashi Vishwanath", location: "Varanasi, Uttar Pradesh", query: "Kashi Vishwanath Temple, Varanasi, India", image: "/images/kashi.jpg", alt: "Kashi Vishwanath Temple in Varanasi" },
  { id: "golden-temple", name: "Golden Temple", location: "Amritsar, Punjab", query: "Golden Temple, Amritsar, India", image: "/images/golden-temple.jpg", alt: "Golden Temple reflected in its sacred pool in Amritsar" },
  { id: "ajmer", name: "Ajmer Sharif", location: "Ajmer, Rajasthan", query: "Ajmer Sharif Dargah, Ajmer, India", image: "/images/ajmer.jpg", alt: "Ajmer Sharif Dargah in Rajasthan" },
  { id: "velankanni", name: "Velankanni Basilica", location: "Velankanni, Tamil Nadu", query: "Basilica of Our Lady of Good Health, Velankanni, India", image: "/images/velankanni.jpg", alt: "White facade of the basilica at Velankanni" },
  { id: "bodh-gaya", name: "Mahabodhi Temple", location: "Bodh Gaya, Bihar", query: "Mahabodhi Temple, Bodh Gaya, India", image: "/images/bodh-gaya.jpg", alt: "Mahabodhi Temple at Bodh Gaya" },
];

export const photoCredits = [
  { name: "Jammu", file: "Hari_niwas.jpg", author: "Imviiku", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Darjeeling", file: "DarjeelingTrainFruitshop_(2).jpg", author: "Arne Hückelheim", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Varkala", file: "Varkala_Beach,_Varkala,_Kerala.jpg", author: "Devender Goyal", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Goa", file: "BeachFun.jpg", author: "Sam 8393", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Vaishno Devi", file: "Snowfall_in_Vaishno_Devi.jpg", author: "Yatin. 123", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Kashi Vishwanath", file: "Kashi_Vishwanath.jpg", author: "Architkumar1234", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Golden Temple", file: "The_Golden_Temple_of_Amrithsar_7.jpg", author: "Shagil Kannur", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Ajmer Sharif", file: "Dargah_of_Sufi_saint_Moinuddin_Chishti_Ajmer_India_(5).JPG", author: "Shahnoor Habib Munmun", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/" },
  { name: "Velankanni", file: "Velankanni_Church_2026.jpg", author: "Rejoy2003", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  { name: "Bodh Gaya", file: "Mahabodhitemple.jpg", author: "Bpilgrim", license: "CC BY-SA 2.5", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.5/" },
];

export function normalise(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function searchDestinations(query: string, category: Category = "all", region: Region = "all") {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  return destinations.filter((destination) => {
    const searchable = normalise([destination.name, destination.country, ...destination.places, ...destination.categories].join(" "));
    return terms.every((term) => searchable.includes(term))
      && (category === "all" || destination.categories.includes(category))
      && (region === "all" || (region === "india" ? destination.country === "India" : destination.country !== "India"));
  });
}

export function nearestDestination(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Invalid coordinates");
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const ranked = destinations.map((destination) => {
    const [targetLatitude, targetLongitude] = destination.coordinates;
    const halfChord = Math.sin(radians(targetLatitude - latitude) / 2) ** 2
      + Math.cos(radians(latitude)) * Math.cos(radians(targetLatitude)) * Math.sin(radians(targetLongitude - longitude) / 2) ** 2;
    return { destination, distanceKm: Math.round(6371 * 2 * Math.asin(Math.sqrt(Math.min(1, halfChord)))) };
  });
  return ranked.sort((first, second) => first.distanceKm - second.distanceKm)[0];
}