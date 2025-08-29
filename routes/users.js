import express from "express"
import { getUsers, getUser, createUser, updateUser, deleteUser } from "../controllers/userController.js"
import { protect, authorize, tenantIsolation } from "../middlewares/auth.js"
import { body } from "express-validator"
import { handleValidationErrors } from "../middlewares/validation.js"

const router = express.Router()

// Apply authentication and tenant isolation to all routes
router.use(protect)
router.use(tenantIsolation)

// Validation for user creation
const validateUserCreation = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  body("firstName").trim().isLength({ min: 2 }).withMessage("First name must be at least 2 characters long"),
  body("lastName").trim().isLength({ min: 2 }).withMessage("Last name must be at least 2 characters long"),
  body("role").optional().isIn(["user", "manager", "admin"]).withMessage("Invalid role"),
  handleValidationErrors,
]

// Validation for user updates
const validateUserUpdate = [
  body("firstName").optional().trim().isLength({ min: 2 }).withMessage("First name must be at least 2 characters long"),
  body("lastName").optional().trim().isLength({ min: 2 }).withMessage("Last name must be at least 2 characters long"),
  body("role").optional().isIn(["user", "manager", "admin"]).withMessage("Invalid role"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  handleValidationErrors,
]

// Routes
router.get("/", authorize("admin", "manager"), getUsers)
router.get("/:userId", getUser)
router.post("/", authorize("admin"), validateUserCreation, createUser)
router.put("/:userId", validateUserUpdate, updateUser)
router.delete("/:userId", authorize("admin"), deleteUser)

export default router
