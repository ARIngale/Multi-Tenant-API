import { body, validationResult } from "express-validator"
import { errorResponse } from "../utils/response.js"

// Validation middleware to handle errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return errorResponse(res, "Validation failed", 400, errors.array())
  }
  next()
}

// User registration validation
export const validateRegister = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  body("firstName").trim().isLength({ min: 2 }).withMessage("First name must be at least 2 characters long"),
  body("lastName").trim().isLength({ min: 2 }).withMessage("Last name must be at least 2 characters long"),
  body("organizationName")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Organization name must be at least 2 characters long"),
  handleValidationErrors,
]

// User login validation
export const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
]

// Password change validation
export const validatePasswordChange = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("New password must contain at least one uppercase letter, one lowercase letter, and one number"),
  handleValidationErrors,
]
