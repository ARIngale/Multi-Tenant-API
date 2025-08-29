import express from "express"
import {
  getAuditLogs,
  getAuditLog,
  getAuditStats,
  getAuditActions,
  exportAuditLogs,
  cleanupAuditLogs,
} from "../controllers/auditController.js"
import { protect, authorize, tenantIsolation } from "../middlewares/auth.js"
import { body, query } from "express-validator"
import { handleValidationErrors } from "../middlewares/validation.js"

const router = express.Router()

// Apply authentication and tenant isolation to all routes
router.use(protect)
router.use(tenantIsolation)

// Validation for audit log queries
const validateAuditQuery = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO 8601 date"),
  query("endDate").optional().isISO8601().withMessage("End date must be a valid ISO 8601 date"),
  query("sortBy")
    .optional()
    .isIn(["timestamp", "action", "userId"])
    .withMessage("Sort by must be timestamp, action, or userId"),
  query("sortOrder").optional().isIn(["asc", "desc"]).withMessage("Sort order must be asc or desc"),
  handleValidationErrors,
]

// Validation for export
const validateExport = [
  query("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO 8601 date"),
  query("endDate").optional().isISO8601().withMessage("End date must be a valid ISO 8601 date"),
  query("format").optional().isIn(["json", "csv"]).withMessage("Format must be json or csv"),
  handleValidationErrors,
]

// Validation for cleanup
const validateCleanup = [
  body("olderThanDays").isInt({ min: 90 }).withMessage("Must be at least 90 days"),
  handleValidationErrors,
]

// Routes
router.get("/", authorize("admin", "manager"), validateAuditQuery, getAuditLogs)
router.get("/actions", authorize("admin", "manager"), getAuditActions)
router.get("/stats", authorize("admin", "manager"), getAuditStats)
router.get("/export", authorize("admin"), validateExport, exportAuditLogs)
router.get("/:logId", authorize("admin", "manager"), getAuditLog)
router.delete("/cleanup", authorize("admin"), validateCleanup, cleanupAuditLogs)

export default router
