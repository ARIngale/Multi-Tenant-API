import express from "express"
import { getProjects } from "../controllers/projectController.js"
import { getUsers } from "../controllers/userController.js"
import { getOrganization } from "../controllers/organizationController.js"
import { authenticateApiKey, checkApiKeyPermissions } from "../middlewares/apiKeyAuth.js"

const router = express.Router()

// Apply API key authentication to all external routes
router.use(authenticateApiKey)

// External API routes for integrations
router.get("/projects", checkApiKeyPermissions("read", ["projects"]), getProjects)
router.get("/users", checkApiKeyPermissions("read", ["users"]), getUsers)
router.get("/organization", checkApiKeyPermissions("read", ["organizations"]), getOrganization)

export default router
