import { verifyToken } from "../utils/jwt.js"
import { errorResponse } from "../utils/response.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import User from "../models/User.js"
import { logger } from "../utils/logger.js"

// Protect routes - require authentication
export const protect = asyncHandler(async (req, res, next) => {
  let token

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1]
  }

  if (!token) {
    return errorResponse(res, "Access denied. No token provided.", 401)
  }

  try {
    // Verify token
    const decoded = verifyToken(token)

    // Get user from token
    const user = await User.findById(decoded.userId)
      .populate("organizationId", "name slug isActive")
      .select("-password")

    if (!user) {
      return errorResponse(res, "User not found", 401)
    }

    if (!user.isActive) {
      return errorResponse(res, "User account is deactivated", 401)
    }

    if (!user.organizationId.isActive) {
      return errorResponse(res, "Organization is deactivated", 401)
    }

    // Add user to request object
    req.user = user
    next()
  } catch (error) {
    logger.error("Authentication error:", error)
    return errorResponse(res, "Invalid token", 401)
  }
})

// Authorize specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Access denied. Please authenticate first.", 401)
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, `Access denied. Required roles: ${roles.join(", ")}. Your role: ${req.user.role}`, 403)
    }

    next()
  }
}

// Tenant isolation middleware
export const tenantIsolation = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, "Authentication required for tenant isolation", 401)
  }

  // Add organization filter to request
  req.organizationId = req.user.organizationId._id
  next()
})
