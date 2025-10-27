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
