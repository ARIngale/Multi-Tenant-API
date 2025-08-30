import { createAuditLog, AUDIT_ACTIONS } from "../utils/auditLogger.js"

// Middleware to log unauthorized access attempts
export const logUnauthorizedAccess = (req, res, next) => {
  // Store original status method
  const originalStatus = res.status

  res.status = function (statusCode) {
    // Log unauthorized access attempts
    if (statusCode === 401 || statusCode === 403) {
      createAuditLog({
        action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
        userId: req.user?._id,
        organizationId: req.organizationId || req.user?.organizationId?._id,
        details: {
          endpoint: `${req.method} ${req.path}`,
          statusCode,
          reason: statusCode === 401 ? "Authentication required" : "Access forbidden",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })
    }

    return originalStatus.call(this, statusCode)
  }

  next()
}

// Middleware to log rate limit exceeded events
export const logRateLimitExceeded = (req, res, next) => {
  if (req.rateLimit && req.rateLimit.remaining === 0) {
    createAuditLog({
      action: AUDIT_ACTIONS.RATE_LIMIT_EXCEEDED,
      details: {
        endpoint: `${req.method} ${req.path}`,
        limit: req.rateLimit.limit,
        windowMs: req.rateLimit.windowMs,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })
  }
  next()
}
