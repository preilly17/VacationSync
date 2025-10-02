export const FLIGHT_REDIRECT_STORAGE_KEY = "vacationsync:flight_redirect";
export const HOTEL_REDIRECT_STORAGE_KEY = "vacationsync:hotel_redirect";
export const ACTIVITY_REDIRECT_STORAGE_KEY = "vacationsync:activity_redirect";

export const markExternalRedirect = (storageKey: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, "true");
};

export const clearExternalRedirect = (storageKey: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(storageKey);
};

export const hasExternalRedirect = (storageKey: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(storageKey) === "true";
};
