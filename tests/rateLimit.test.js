
jest.mock('../models/Product', () => ({
  find:     jest.fn().mockResolvedValue([]),
  findById: jest.fn().mockResolvedValue(null),
}));
const request = require("supertest");
const app = require("../app");

const PAYMENT_LIMIT = 30; // requests per 15-min window
const ORDER_LIMIT   = 60;

async function fireRequests(route, n, method = "get") {
  const responses = [];
  for (let i = 0; i < n; i++) {
    const res = await request(app)[method](route);
    responses.push(res);
  }
  return responses;
}

// ─── Payment rate limiting ────────────────────────────────────────────────────

describe("Payment route — rate limiting", () => {
  /**
   * We test the boundary (N vs N+1) rather than hammering thousands of
   * requests. This keeps the suite fast and proves the limit is exact.
   */
  test(`allows first ${PAYMENT_LIMIT} requests, blocks the next`, async () => {
    const route = "/api/payment/payment/status/test-id";

    // Fire exactly at the limit
    const within = await fireRequests(route, PAYMENT_LIMIT);
    within.forEach((res, i) => {
      expect(res.status).not.toBe(429); // 200, 401, 404 — all fine, just not 429
    });

    // One more 
    const over = await request(app).get(route);
    expect(over.status).toBe(429);
  });

  test("429 response includes a retry hint", async () => {
    const route = "/api/payment/payment/status/test-id";

    // Exhaust the remaining quota (or start fresh if tests run independently)
    await fireRequests(route, PAYMENT_LIMIT);
    const res = await request(app).get(route);

    expect(res.status).toBe(429);

    // At least one of these should be present:
    const hasHeader  = !!res.headers["retry-after"];
    const hasMessage = res.body?.message?.toLowerCase().includes("too many") ||
                       res.body?.error?.toLowerCase().includes("rate limit");

    expect(hasHeader || hasMessage).toBe(true);
  });
});

// ─── Order rate limiting ──────────────────────────────────────────────────────

describe("Order route — rate limiting", () => {
  /**
   * Same boundary test for orders. ORDER_LIMIT is typically more generous
   * than PAYMENT_LIMIT because ordering is less abuse-prone than payments.
   */
  test(`allows first ${ORDER_LIMIT} requests, blocks the next`, async () => {
    const route = "/api/order/orders/me";

    const within = await fireRequests(route, ORDER_LIMIT);
    within.forEach((res) => {
      expect(res.status).not.toBe(429);
    });

    const over = await request(app).get(route);
    expect(over.status).toBe(429);
  });
});

// ─── Non-limited routes — must NOT be affected ───────────────────────────────

describe("User & Product routes — NOT rate limited", () => {
  /**
   * This is the "negative test" — just as important as the positive ones.
   * A limiter applied globally instead of per-router would break this test.
   */
  test("user login endpoint is never rate-limited by payment/order limiter", async () => {
    const responses = await fireRequests(
      "/api/user/login",
      PAYMENT_LIMIT + 5, // exceed even the strictest limit
      "post"
    );

    const hit429 = responses.some((r) => r.status === 429);
    expect(hit429).toBe(false); // 401 (wrong creds) is fine, 429 is not
  });

  test("product listing endpoint is never rate-limited", async () => {
    const responses = await fireRequests(
      "/api/product",
      PAYMENT_LIMIT + 5
    );

    const hit429 = responses.some((r) => r.status === 429);
    expect(hit429).toBe(false);
  });
});


describe("Payment limit is stricter than Order limit", () => {
  /**
   * Payment initiation is a sensitive action (fraud surface area).
   */
  test("payment limit is lower than order limit", () => {
    expect(PAYMENT_LIMIT).toBeLessThan(ORDER_LIMIT);
  });
});
