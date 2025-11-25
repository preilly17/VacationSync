import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("DatabaseStorage wish list helpers", () => {
  let queryMock: jest.Mock;
  let DatabaseStorage: typeof import("../storage").DatabaseStorage;

  beforeEach(async () => {
    jest.resetModules();
    queryMock = jest.fn();
    jest.doMock("../db", () => ({ query: queryMock }));
    ({ DatabaseStorage } = await import("../storage"));
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  const createStorage = () => {
    const storage = new DatabaseStorage();
    const ensureSpy = jest
      .spyOn(storage as unknown as { ensureWishListStructures: () => Promise<void> }, "ensureWishListStructures")
      .mockResolvedValue();
    return { storage, ensureSpy };
  };

  it("returns wish list ideas with creator details and counts", async () => {
    const createdAt = new Date("2024-03-01T10:00:00Z");
    const updatedAt = new Date("2024-03-02T11:00:00Z");

    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 7,
          trip_id: 42,
          title: "Hidden speakeasy",
          url: "https://instagram.com/reel/123",
          notes: "Let\'s add this to the plan",
          tags: ["Nightlife", "Drinks"],
          thumbnail_url: "https://cdn.example.com/thumb.jpg",
          image_url: null,
          metadata: {
            url: "https://instagram.com/reel/123",
            title: "Secret Tokyo bar",
            siteName: "Instagram",
          },
          created_by: "user-1",
          promoted_draft_id: null,
          created_at: createdAt,
          updated_at: updatedAt,
          save_count: "5",
          saved_by_user: true,
          comment_count: "2",
          creator_id: "user-1",
          creator_email: "alex@example.com",
          creator_username: "alex",
          creator_first_name: "Alex",
          creator_last_name: "Rivera",
          creator_phone_number: null,
          creator_password_hash: null,
          creator_profile_image_url: "https://cdn.example.com/alex.png",
          creator_cashapp_username: null,
          creator_cash_app_username: null,
          creator_cashapp_phone: null,
          creator_cash_app_phone: null,
          creator_venmo_username: null,
          creator_venmo_phone: null,
          creator_timezone: "UTC",
          creator_default_location: null,
          creator_default_location_code: null,
          creator_default_city: null,
          creator_default_country: null,
          creator_auth_provider: "password",
          creator_notification_preferences: null,
          creator_has_seen_home_onboarding: false,
          creator_has_seen_trip_onboarding: false,
          creator_created_at: createdAt,
          creator_updated_at: updatedAt,
        },
      ],
    });

    const { storage, ensureSpy } = createStorage();
    const ideas = await storage.getTripWishListIdeas(42, "user-1", { sort: "newest" });

    expect(ensureSpy).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM trip_wish_list_items"),
      expect.arrayContaining([42, "user-1"]),
    );

    expect(ideas).toEqual([
      expect.objectContaining({
        id: 7,
        tripId: 42,
        title: "Hidden speakeasy",
        url: "https://instagram.com/reel/123",
        notes: "Let\'s add this to the plan",
        tags: ["Nightlife", "Drinks"],
        metadata: expect.objectContaining({ title: "Secret Tokyo bar" }),
        saveCount: 5,
        currentUserSaved: true,
        commentCount: 2,
        creator: expect.objectContaining({
          id: "user-1",
          email: "alex@example.com",
          firstName: "Alex",
          lastName: "Rivera",
          profileImageUrl: "https://cdn.example.com/alex.png",
        }),
      }),
    ]);

    ensureSpy.mockRestore();
  });

  it("saves a wish list idea for a user when it was not already saved", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT existing
      .mockResolvedValueOnce({ rows: [] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ count: 1 }] }) // COUNT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const { storage, ensureSpy } = createStorage();
    const result = await storage.toggleWishListSave(99, "user-7");

    expect(ensureSpy).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenNthCalledWith(2, expect.stringContaining("SELECT id"), [99, "user-7"]);
    expect(queryMock).toHaveBeenNthCalledWith(3, expect.stringContaining("INSERT INTO trip_wish_list_saves"), [99, "user-7"]);
    expect(result).toEqual({ saved: true, saveCount: 1 });

    ensureSpy.mockRestore();
  });

  it("removes a wish list save when the user toggles off", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 55 }] }) // SELECT existing save
      .mockResolvedValueOnce({ rows: [] }) // DELETE
      .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // COUNT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const { storage, ensureSpy } = createStorage();
    const result = await storage.toggleWishListSave(10, "user-2");

    expect(ensureSpy).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenNthCalledWith(3, expect.stringContaining("DELETE FROM trip_wish_list_saves"), [55]);
    expect(result).toEqual({ saved: false, saveCount: 0 });

    ensureSpy.mockRestore();
  });

  it("converts legacy text array tags to JSONB during initialization", async () => {
    const executedSql: string[] = [];
    queryMock.mockImplementation((sql: string) => {
      executedSql.push(sql);
      if (sql.includes("information_schema.columns") && sql.includes("column_name = 'tags'")) {
        return Promise.resolve({ rows: [{ data_type: "ARRAY", udt_name: "_text" }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const storage = new DatabaseStorage();
    await (
      storage as unknown as { ensureWishListStructures: () => Promise<void> }
    ).ensureWishListStructures();

    const converted = executedSql.some((sql) =>
      sql.includes("ALTER TABLE trip_wish_list_items") &&
      sql.includes("ALTER COLUMN tags TYPE JSONB"),
    );

    expect(converted).toBe(true);
    expect(
      executedSql.some((sql) =>
        sql.includes(
          "ALTER TABLE trip_wish_list_items ALTER COLUMN tags SET DEFAULT '[]'::jsonb",
        ),
      ),
    ).toBe(true);
  });

  it("clears duplicate promoted draft links before adding a unique constraint", async () => {
    const executedSql: string[] = [];
    queryMock.mockImplementation((sql: string) => {
      executedSql.push(sql);
      if (sql.includes("information_schema.columns") && sql.includes("column_name = 'tags'")) {
        return Promise.resolve({ rows: [{ data_type: "jsonb", udt_name: "jsonb" }] });
      }

      if (
        sql.includes("information_schema.table_constraints") &&
        sql.includes("trip_wish_list_items_promoted_draft_id_key")
      ) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const storage = new DatabaseStorage();
    await (storage as unknown as { ensureWishListStructures: () => Promise<void> }).ensureWishListStructures();

    const dedupeSql = executedSql.find((sql) => sql.includes("ROW_NUMBER() OVER"));
    expect(dedupeSql).toBeDefined();
    expect(dedupeSql).toContain("LEFT JOIN trip_proposal_drafts");
    expect(dedupeSql).toContain("CASE WHEN i.id = d.item_id THEN 0 ELSE 1 END");
  });
});
