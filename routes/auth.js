import express from "express"
import { register, login, getProfile, changePassword, logout } from "../controllers/authController.js"
import { validateRegister, validateLogin, validatePasswordChange } from "../middlewares/validation.js"
import { protect } from "../middlewares/auth.js"

const router = express.Router()

// Public routes
router.post("/register", validateRegister, register)
router.post("/login", validateLogin, login)

// Protected routes
router.use(protect) // All routes below require authentication

router.get("/profile", getProfile)
router.put("/change-password", validatePasswordChange, changePassword)
router.post("/logout", logout)

export default router
