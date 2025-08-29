import express from "express"
import {
  getApiKeys,
  getApiKey,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  deleteApiKey,
} from "../controllers/apiKeyController.js"
import { protect, authorize, tenantIsolation } from "../middlewares/auth.js"
import { body } from "express-validator"
import { handleValidationErrors } from "../middlewares/validation.js"

const router = express.Router()

// Apply authentication and tenant isolation to all routes
router.use(protect)
router.use(tenantIsolation)

// Validation for API key creation
const validateApiKeyCreation = [
  body("name").trim().isLength({ min: 2 }).withMessage("API key name must be at least 2 characters long"),
  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array")
    .custom((permissions) => {
      const validPermissions = ["read", "write", "admin"]
      const invalid = permissions.filter((p) => !validPermissions.includes(p))
      if (invalid.length > 0) {
        throw new Error(`Invalid permissions: ${invalid.join(", ")}`)
      }
      return true
    }),
  body("scopes")
    .optional()
    .isArray()
    .withMessage("Scopes must be an array")
    .custom((scopes) => {
      const validScopes = ["users", "projects", "organizations", "audit"]
      const invalid = scopes.filter((s) => !validScopes.includes(s))
      if (invalid.length > 0) {
        throw new Error(`Invalid scopes: ${invalid.join(", ")}`)
      }
      return true
    }),
  body("expiresIn").optional().isIn(["30d", "90d", "1y"]).withMessage("Invalid expiration period"),
  handleValidationErrors,
]

// Validation for API key updates
const validateApiKeyUpdate = [
  body("name").optional().trim().isLength({ min: 2 }).withMessage("API key name must be at least 2 characters long"),
  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array")
    .custom((permissions) => {
      const validPermissions = ["read", "write", "admin"]
      const invalid = permissions.filter((p) => !validPermissions.includes(p))
      if (invalid.length > 0) {
        throw new Error(`Invalid permissions: ${invalid.join(", ")}`)
      }
      return true
    }),
  body("scopes")
    .optional()
    .isArray()
    .withMessage("Scopes must be an array")
    .custom((scopes) => {
      const validScopes = ["users", "projects", "organizations", "audit"]
      const invalid = scopes.filter((s) => !validScopes.includes(s))
      if (invalid.length > 0) {
        throw new Error(`Invalid scopes: ${invalid.join(", ")}`)
      }
      return true
    }),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  handleValidationErrors,
]

// Routes
router.get("/", authorize("admin", "manager"), getApiKeys)
router.get("/:keyId", authorize("admin", "manager"), getApiKey)
router.post("/", authorize("admin", "manager"), validateApiKeyCreation, createApiKey)
router.put("/:keyId", authorize("admin", "manager"), validateApiKeyUpdate, updateApiKey)
router.patch("/:keyId/revoke", authorize("admin", "manager"), revokeApiKey)
router.delete("/:keyId", authorize("admin"), deleteApiKey)

export default router
