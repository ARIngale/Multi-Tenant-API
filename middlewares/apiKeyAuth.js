import { asyncHandler } from "../utils/asyncHandler.js"
import { errorResponse } from "../utils/response.js"
import { hashApiKey, validateApiKeyFormat, extractKeyId } from "../utils/apiKey.js"
import { logger } from "../utils/logger.js"
import ApiKey from "../models/ApiKey.js"
import AuditLog from "../models/AuditLog.js"

// API Key authentication middleware
export const authenticateApiKey = asyncHandler(async (req, res, next) => {
  let apiKey

  // Check for API key in headers
  if (req.headers["x-api-key"]) {
    apiKey = req.headers["x-api-key"]
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    apiKey = req.headers.authorization.split(" ")[1]
  }

  if (!apiKey) {
    return errorResponse(res, "API key required", 401)
  }

  // Validate API key format
  if (!validateApiKeyFormat(apiKey)) {
    return errorResponse(res, "Invalid API key format", 401)
  }

  try {
    // Hash the provided API key
    const hashedKey = hashApiKey(apiKey)
    const keyId = extractKeyId(apiKey)

    // Find the API key in database
    const apiKeyDoc = await ApiKey.findOne({
      keyId,
      hashedKey,
      isActive: true,
    }).populate("organizationId", "name slug isActive")

    if (!apiKeyDoc) {
      // Log failed API key attempt
      await AuditLog.create({
        action: "API_KEY_AUTH_FAILED",
        details: {
          keyId,
          reason: "API key not found or inactive",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      return errorResponse(res, "Invalid API key", 401)
    }

    // Check if API key is expired
    if (apiKeyDoc.expiresAt && apiKeyDoc.expiresAt < new Date()) {
      await AuditLog.create({
        action: "API_KEY_AUTH_FAILED",
        organizationId: apiKeyDoc.organizationId._id,
        details: {
          keyId,
          reason: "API key expired",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      return errorResponse(res, "API key expired", 401)
    }

    // Check if organization is active
    if (!apiKeyDoc.organizationId.isActive) {
      return errorResponse(res, "Organization is deactivated", 401)
    }

    // Update last used timestamp
    apiKeyDoc.lastUsed = new Date()
    await apiKeyDoc.save()

    // Add API key info to request
    req.apiKey = apiKeyDoc
    req.organizationId = apiKeyDoc.organizationId._id
    req.isApiKeyAuth = true

    // Log successful API key usage
    await AuditLog.create({
      action: "API_KEY_USED",
      organizationId: apiKeyDoc.organizationId._id,
      details: {
        keyId,
        keyName: apiKeyDoc.name,
        endpoint: `${req.method} ${req.path}`,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    next()
  } catch (error) {
    logger.error("API key authentication error:", error)
    return errorResponse(res, "API key authentication failed", 500)
  }
})

// Check API key permissions
export const checkApiKeyPermissions = (requiredPermission, requiredScopes = []) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return errorResponse(res, "API key authentication required", 401)
    }

    // Check permissions
    if (!req.apiKey.permissions.includes(requiredPermission) && !req.apiKey.permissions.includes("admin")) {
      return errorResponse(res, `Insufficient permissions. Required: ${requiredPermission}`, 403)
    }

    // Check scopes
    if (requiredScopes.length > 0) {
      const hasRequiredScope = requiredScopes.some((scope) => req.apiKey.scopes.includes(scope))
      if (!hasRequiredScope && !req.apiKey.permissions.includes("admin")) {
        return errorResponse(res, `Insufficient scope. Required: ${requiredScopes.join(" or ")}`, 403)
      }
    }

    next()
  }
}
