import { describe, expect, it } from "@jest/globals";

import {
  insertWishListIdeaSchema,
  insertWishListProposalDraftSchema,
} from "../schema";

describe("wish list tag normalization", () => {
  it("treats missing or null tags as an empty array", () => {
    const minimal = insertWishListIdeaSchema.parse({ tripId: 1, title: "Snack run" });
    expect(minimal.tags).toEqual([]);

    const withNull = insertWishListIdeaSchema.parse({
      tripId: 1,
      title: "Late-night ramen",
      tags: null,
    });
    expect(withNull.tags).toEqual([]);
  });

  it("deduplicates and trims tag values from arrays", () => {
    const result = insertWishListIdeaSchema.parse({
      tripId: 2,
      title: "Sunset cruise",
      tags: ["  Food  ", "Drinks", "food", "", "Drinks"],
    });

    expect(result.tags).toEqual(["Food", "Drinks", "food"]);
  });

  it("splits comma separated strings and nested values", () => {
    const result = insertWishListIdeaSchema.parse({
      tripId: 3,
      title: "Farmer's market",
      tags: {
        raw: "Fresh,Local, Fresh",
        extra: ["Outdoors", "Local"],
      },
    });

    expect(result.tags).toEqual(["Fresh", "Local", "Outdoors"]);
  });
});

describe("wish list URL normalization", () => {
  it("preserves valid links with uppercase protocols", () => {
    const result = insertWishListIdeaSchema.parse({
      tripId: 4,
      title: "Late-night ramen",
      url: "HTTPS://Example.com/Spots",
    });

    expect(result.url).toBe("https://example.com/Spots");
  });

  it("treats empty or null links as missing", () => {
    const empty = insertWishListIdeaSchema.parse({
      tripId: 5,
      title: "Dessert crawl",
      url: "   ",
    });

    expect(empty.url).toBeNull();

    const withNull = insertWishListIdeaSchema.parse({
      tripId: 5,
      title: "Dessert crawl",
      url: null,
    });

    expect(withNull.url).toBeNull();
  });

  it("normalizes social links without a protocol", () => {
    const instagram = insertWishListIdeaSchema.parse({
      tripId: 6,
      title: "Brunch inspo",
      url: "instagram.com/spots/123",
    });

    expect(instagram.url).toBe("https://instagram.com/spots/123");

    const tiktok = insertWishListIdeaSchema.parse({
      tripId: 6,
      title: "Hidden bars",
      url: "www.tiktok.com/@citysecrets",
    });

    expect(tiktok.url).toBe("https://www.tiktok.com/@citysecrets");
  });
});

describe("wish list proposal draft tag normalization", () => {
  it("shares the same coercion logic", () => {
    const draft = insertWishListProposalDraftSchema.parse({
      tripId: 9,
      itemId: 4,
      createdBy: "user-1",
      title: "Group tasting menu",
      url: null,
      tags: "Food, Drinks, Food",
    });

    expect(draft.tags).toEqual(["Food", "Drinks"]);
  });
});
