
const rateLimit = require("express-rate-limit");

const createLimiter = ({ limit, windowMs, name }) =>
  rateLimit({
    windowMs,     // sliding window length in ms
    limit,        // max requests per window per IP
    standardHeaders: "draft-7", // sends RateLimit-* headers (RFC draft)
    legacyHeaders: false,

    // What the client receives when throttled
    handler: (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000); // seconds
      res.set("Retry-After", retryAfter);
      res.status(429).json({
        status: "error",
        message: `Too many requests to ${name} routes. Retry after ${retryAfter}s.`,
        retryAfter,
      });
    },
  });

// Payment: stricter 30 req / 15 min (fraud surface area is higher)
const paymentLimiter = createLimiter({
  limit: 30,
  windowMs: 15 * 60 * 1000,
  name: "payment",
});

// Order: more generous 60 req / 15 min
const orderLimiter = createLimiter({
  limit: 60,
  windowMs: 15 * 60 * 1000,
  name: "order",
});

module.exports = { paymentLimiter, orderLimiter };
