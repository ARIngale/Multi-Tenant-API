import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors"


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

dotenv.config({ debug: true })

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
  optionsSuccessStatus: 200,
}
app.use(cors(corsOptions))


app.use(logRateLimitExceeded)
app.use(logUnauthorizedAccess)

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