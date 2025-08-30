import AuditLog from "../models/AuditLog.js"
import { logger } from "./logger.js"

// Helper function to create audit log entries
export const createAuditLog = async (data) => {
  try {
    const auditLog = await AuditLog.create(data)
    return auditLog
  } catch (error) {
    logger.error("Failed to create audit log:", error)
    // Don't throw error to avoid breaking the main operation
    return null
  }
}

// Middleware to automatically log API requests
export const auditMiddleware = (action, getDetails = () => ({})) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json

    // Override json method to capture response
    res.json = function (data) {
      // Create audit log after successful response
      if (res.statusCode < 400) {
        createAuditLog({
          action,
          userId: req.user?._id,
          organizationId: req.organizationId || req.user?.organizationId?._id,
          details: {
            ...getDetails(req, res, data),
            endpoint: `${req.method} ${req.path}`,
            statusCode: res.statusCode,
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        })
      }

      // Call original json method
      return originalJson.call(this, data)
    }

    next()
  }
}

// Predefined audit actions
export const AUDIT_ACTIONS = {
  // Authentication
  USER_REGISTERED: "USER_REGISTERED",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",

  // User Management
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  ROLE_CHANGED: "ROLE_CHANGED",

  // Organization Management
  ORGANIZATION_UPDATED: "ORGANIZATION_UPDATED",

  // Project Management
  PROJECT_CREATED: "PROJECT_CREATED",
  PROJECT_UPDATED: "PROJECT_UPDATED",
  PROJECT_DELETED: "PROJECT_DELETED",

  // API Key Management
  API_KEY_GENERATED: "API_KEY_GENERATED",
  API_KEY_UPDATED: "API_KEY_UPDATED",
  API_KEY_REVOKED: "API_KEY_REVOKED",
  API_KEY_DELETED: "API_KEY_DELETED",
  API_KEY_USED: "API_KEY_USED",
  API_KEY_AUTH_FAILED: "API_KEY_AUTH_FAILED",

  // Security Events
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // System Events
  AUDIT_LOGS_EXPORTED: "AUDIT_LOGS_EXPORTED",
  AUDIT_LOGS_CLEANED: "AUDIT_LOGS_CLEANED",
}

// Helper to log security events
export const logSecurityEvent = async (action, details, req) => {
  return createAuditLog({
    action,
    userId: req.user?._id,
    organizationId: req.organizationId || req.user?.organizationId?._id,
    details,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  })
}
