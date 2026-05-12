const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const { paymentLimiter, orderLimiter } = require("./middlewares/rateLimiter");
const orderRouter = require('./routes/orderRoute');
const paymentRouter = require('./routes/paymentRoute');
const productRouter = require('./routes/productRoute');
const userRouter = require('./routes/userRoute');
const regionMiddleware = require('./middlewares/regionMiddleware');
const errorMiddleware = require('./middlewares/errorMiddleware');
const { HTTP_STATUS } = require('./config/constants');

const app = express();

// Region check first so it runs for every request (logs to stderr so you see it)
app.use(regionMiddleware);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());


app.use('/api/payment', paymentRouter);
app.use('/api/order',orderLimiter, orderRouter);
app.use('/api/product',paymentLimiter, productRouter);
app.use('/api/user', userRouter);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Real Estate Ledger API' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Not Found' });
});

app.use(errorMiddleware);

module.exports = app;
