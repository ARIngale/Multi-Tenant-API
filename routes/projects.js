import express from "express"
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
} from "../controllers/projectController.js"
import { protect, authorize, tenantIsolation } from "../middlewares/auth.js"
import { body } from "express-validator"
import { handleValidationErrors } from "../middlewares/validation.js"

const router = express.Router()

// Apply authentication and tenant isolation to all routes
router.use(protect)
router.use(tenantIsolation)

// Validation for project creation
const validateProjectCreation = [
  body("name").trim().isLength({ min: 2 }).withMessage("Project name must be at least 2 characters long"),
  body("description").optional().trim(),
  body("members").optional().isArray().withMessage("Members must be an array"),
  body("members.*.userId").optional().isMongoId().withMessage("Invalid user ID"),
  body("members.*.role").optional().isIn(["viewer", "contributor", "admin"]).withMessage("Invalid member role"),
  handleValidationErrors,
]

// Validation for project updates
const validateProjectUpdate = [
  body("name").optional().trim().isLength({ min: 2 }).withMessage("Project name must be at least 2 characters long"),
  body("description").optional().trim(),
  body("status").optional().isIn(["active", "inactive", "archived"]).withMessage("Invalid status"),
  body("members").optional().isArray().withMessage("Members must be an array"),
  body("members.*.userId").optional().isMongoId().withMessage("Invalid user ID"),
  body("members.*.role").optional().isIn(["viewer", "contributor", "admin"]).withMessage("Invalid member role"),
  handleValidationErrors,
]

// Routes
router.get("/", getProjects)
router.get("/:projectId", getProject)
router.post("/", authorize("admin", "manager"), validateProjectCreation, createProject)
router.put("/:projectId", validateProjectUpdate, updateProject)
router.delete("/:projectId", deleteProject)

export default router
