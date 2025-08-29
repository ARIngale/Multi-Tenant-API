import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors"


// Import routes
import authRoutes from "./routes/auth.js"
import userRoutes from "./routes/users.js"
import organizationRoutes from "./routes/organizations.js"

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


// API routes
app.use("/api/v1/auth", authRoutes)
app.use("/api/v1/users", userRoutes)
app.use("/api/v1/organizations", organizationRoutes)

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