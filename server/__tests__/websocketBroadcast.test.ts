import { beforeAll, describe, expect, it, jest } from "@jest/globals";

type AssignClientFn = (clientMap: Map<any, any>, ws: any, data: any) => void;
type BroadcastFn = (clientMap: Map<any, any>, tripId: number, message: any, wsLib: { OPEN: number }) => void;

let assignClientToTrip: AssignClientFn;
let broadcastMessageToTripClients: BroadcastFn;

beforeAll(async () => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

  const routesModule: any = await import("../routes");
  assignClientToTrip = routesModule.assignClientToTrip;
  broadcastMessageToTripClients = routesModule.broadcastMessageToTripClients;
});

describe("WebSocket trip broadcasts", () => {
  it("stores numeric trip IDs and sends broadcasts to matching clients", () => {
    const clients = new Map<any, { userId: string; tripId?: number }>();
    const fakeSocket = { readyState: 1, send: jest.fn() };

    assignClientToTrip(clients, fakeSocket as any, { userId: "organizer", tripId: "42" });

    expect(clients.get(fakeSocket)).toEqual({ userId: "organizer", tripId: 42 });

    broadcastMessageToTripClients(clients, 42, { type: "activity_created" }, { OPEN: 1 });

    expect(fakeSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "activity_created" }),
    );
  });

  it("skips broadcasting for invalid trip IDs", () => {
    const clients = new Map<any, { userId: string; tripId?: number }>();
    const fakeSocket = { readyState: 1, send: jest.fn() };
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    assignClientToTrip(clients, fakeSocket as any, {
      userId: "organizer",
      tripId: "not-a-number",
    });

    expect(clients.get(fakeSocket)).toEqual({ userId: "organizer" });

    broadcastMessageToTripClients(clients, Number.NaN, { foo: "bar" }, { OPEN: 1 });
    broadcastMessageToTripClients(clients, 123, { foo: "bar" }, { OPEN: 1 });

    expect(fakeSocket.send).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
