export type NearbyPlaceCategory = "toilets" | "restaurant" | "park" | "playground";

export type NearbyPlace = {
  id: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
  category: NearbyPlaceCategory;
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
};

export const NEARBY_PLACE_CATEGORIES: Array<{ key: NearbyPlaceCategory; label: string; shortLabel: string }> = [
  { key: "toilets", label: "Public toilets", shortLabel: "Toilets" },
  { key: "restaurant", label: "Restaurants", shortLabel: "Food" },
  { key: "park", label: "Parks", shortLabel: "Parks" },
  { key: "playground", label: "Kids’ playgrounds", shortLabel: "Playgrounds" },
];
