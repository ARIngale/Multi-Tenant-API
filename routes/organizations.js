import express from "express"
import { getOrganization, updateOrganization, getOrganizationStats } from "../controllers/organizationController.js"
import { protect, authorize, tenantIsolation } from "../middlewares/auth.js"
import { body } from "express-validator"
import { handleValidationErrors } from "../middlewares/validation.js"

const router = express.Router()

// Apply authentication and tenant isolation to all routes
router.use(protect)
router.use(tenantIsolation)

// Validation for organization updates
const validateOrganizationUpdate = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Organization name must be at least 2 characters long"),
  body("description").optional().trim(),
  body("domain").optional().isURL({ require_protocol: false }).withMessage("Please provide a valid domain"),
  body("settings.maxUsers").optional().isInt({ min: 1 }).withMessage("Max users must be a positive integer"),
  body("settings.features").optional().isArray().withMessage("Features must be an array"),
  handleValidationErrors,
]

// Routes
router.get("/", getOrganization)
router.put("/", authorize("admin"), validateOrganizationUpdate, updateOrganization)
router.get("/stats", authorize("admin", "manager"), getOrganizationStats)

export default router
