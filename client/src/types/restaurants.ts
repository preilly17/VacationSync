export type RestaurantPlatform = "resy" | "open_table";

export interface RestaurantLinkBuilderResult {
  platform: RestaurantPlatform;
  url: string;
  date: string;
  time?: string;
  partySize: number;
  city: string;
  stateCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface RestaurantManualAddPrefill {
  platform: RestaurantPlatform;
  url: string;
  date: string;
  time?: string;
  partySize: number;
  city?: string;
  country?: string;
  name?: string;
  address?: string;
}
