import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import helmet from "helmet"
import cors from "cors"
import rateLimit from "express-rate-limit"

// Import routes
import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/users.js"
import organizationRoutes from "./routes/organizations.js"
import projectRoutes from "./routes/projects.js"
import apiKeyRoutes from "./routes/apiKeys.js"
import auditRoutes from "./routes/audit.js"
import externalRoutes from "./routes/external.js"

// Import middleware
import { errorHandler } from "./middlewares/errorHandler.js"
import { logUnauthorizedAccess, logRateLimitExceeded } from "./middlewares/auditMiddleware.js"
import { logger } from "./utils/logger.js"

dotenv.config({ debug: true })

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet())


// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions))

// Rate limiting
const limiter = rateLimit({
  windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: (req, res) => {
    req.rateLimit = {
      limit: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      remaining: 0,
    }
  },
})
app.use("/api/", limiter)

app.use(logRateLimitExceeded)
app.use(logUnauthorizedAccess)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`)
  next()
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API routes
app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/users", userRoutes)
app.use("/api/v1/organizations", organizationRoutes)
app.use("/api/v1/projects", projectRoutes)
app.use("/api/v1/api-keys", apiKeyRoutes)
app.use("/api/v1/audit", auditRoutes)
app.use("/api/v1/external", externalRoutes)


// Global error handler
app.use(errorHandler)

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/multitenant_api")
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });

export default app;