const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db.js');

const authRoute = require('./routes/authRoute');
const tenantRoutes = require('./routes/tenantRoutes');
const adminRoutes = require('./routes/adminRoutes');
const propertyRoutes = require('./routes/propertyRoutes');

dotenv.config();


const app = express();

// === Trust Proxy Configuration ===

app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://irorunhomes.vercel.app',
  "https://irorunhomes.com",
  "https://www.irorunhomes.com",
  "irorunhomes.com",
  'http://localhost:5173',
];
// === Middleware ===
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 100,
  message: 'Too many requests from this IP, please try again after 10 minutes',
});

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// === Routes ===
app.get('/api', (req, res) => {
  res.json({
    message:
      'Welcome to the Irorun Homes API. Your number one source for affordable house.',
  });
});

app.use('/api/v1/auth', limiter, authRoute);
app.use('/api/v1/tenant', tenantRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/properties', propertyRoutes);

// === Start Server after DB Connect ===
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    console.log("MongoDB connected successfully");
    app.listen(PORT, () => {
      console.log(
        `✅ Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
      );
      console.log(`📘 API docs available at http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });