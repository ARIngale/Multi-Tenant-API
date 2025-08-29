import { asyncHandler } from "../utils/asyncHandler.js"
import { successResponse, errorResponse } from "../utils/response.js"
import { generateToken } from "../utils/jwt.js"
import { logger } from "../utils/logger.js"
import User from "../models/User.js"
import Organization from "../models/Organization.js"
import AuditLog from "../models/AuditLog.js"

// Register new user and organization
export const register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, organizationName } = req.body

  // Check if user already exists
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    return errorResponse(res, "User with this email already exists", 400)
  }

  // Check if organization already exists
  const existingOrg = await Organization.findOne({ name: organizationName })
  if (existingOrg) {
    return errorResponse(res, "Organization with this name already exists", 400)
  }

  try {
    // Create organization first
    const organization = await Organization.create({
      name: organizationName,
      settings: {
        maxUsers: 50,
        features: ["projects"],
      },
    })

    // Create user with admin role for new organization
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: "admin",
      organizationId: organization._id,
    })

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      role: user.role,
      organizationId: organization._id,
    })

    // Log registration
    await AuditLog.create({
      action: "USER_REGISTERED",
      userId: user._id,
      organizationId: organization._id,
      details: {
        email: user.email,
        role: user.role,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`New user registered: ${email} for organization: ${organizationName}`)

    successResponse(
      res,
      {
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organization: {
            id: organization._id,
            name: organization.name,
            slug: organization.slug,
          },
        },
      },
      "Registration successful",
      201,
    )
  } catch (error) {
    logger.error("Registration error:", error)
    return errorResponse(res, "Registration failed", 500)
  }
})

// Login user
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body

  try {
    // Find user with password field
    const user = await User.findOne({ email }).select("+password").populate("organizationId", "name slug isActive")

    if (!user) {
      // Log failed login attempt
      await AuditLog.create({
        action: "LOGIN_FAILED",
        details: {
          email,
          reason: "User not found",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      return errorResponse(res, "Invalid credentials", 401)
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      // Log failed login attempt
      await AuditLog.create({
        action: "LOGIN_FAILED",
        userId: user._id,
        organizationId: user.organizationId._id,
        details: {
          email,
          reason: "Invalid password",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      return errorResponse(res, "Invalid credentials", 401)
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse(res, "Account is deactivated", 401)
    }

    // Check if organization is active
    if (!user.organizationId.isActive) {
      return errorResponse(res, "Organization is deactivated", 401)
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate JWT token
    const token = generateToken({
      userId: user._id,
      role: user.role,
      organizationId: user.organizationId._id,
    })

    // Log successful login
    await AuditLog.create({
      action: "LOGIN_SUCCESS",
      userId: user._id,
      organizationId: user.organizationId._id,
      details: {
        email: user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`User logged in: ${email}`)

    successResponse(res, {
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        lastLogin: user.lastLogin,
        organization: {
          id: user.organizationId._id,
          name: user.organizationId.name,
          slug: user.organizationId.slug,
        },
      },
    })
  } catch (error) {
    logger.error("Login error:", error)
    return errorResponse(res, "Login failed", 500)
  }
})

// Get current user profile
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("organizationId", "name slug")

  successResponse(res, {
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      lastLogin: user.lastLogin,
      organization: {
        id: user.organizationId._id,
        name: user.organizationId.name,
        slug: user.organizationId.slug,
      },
    },
  })
})

// Change password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body

  try {
    // Get user with password
    const user = await User.findById(req.user._id).select("+password")

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword)
    if (!isCurrentPasswordValid) {
      return errorResponse(res, "Current password is incorrect", 400)
    }

    // Update password
    user.password = newPassword
    await user.save()

    // Log password change
    await AuditLog.create({
      action: "PASSWORD_CHANGED",
      userId: user._id,
      organizationId: req.user.organizationId._id,
      details: {
        email: user.email,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`Password changed for user: ${user.email}`)

    successResponse(res, null, "Password changed successfully")
  } catch (error) {
    logger.error("Password change error:", error)
    return errorResponse(res, "Password change failed", 500)
  }
})

// Logout (client-side token removal, but log the action)
export const logout = asyncHandler(async (req, res) => {
  // Log logout
  await AuditLog.create({
    action: "LOGOUT",
    userId: req.user._id,
    organizationId: req.user.organizationId._id,
    details: {
      email: req.user.email,
    },
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  })

  logger.info(`User logged out: ${req.user.email}`)

  successResponse(res, null, "Logged out successfully")
})
