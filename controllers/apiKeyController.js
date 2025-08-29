import { asyncHandler } from "../utils/asyncHandler.js"
import { successResponse, errorResponse } from "../utils/response.js"
import { generateApiKey } from "../utils/apiKey.js"
import { logger } from "../utils/logger.js"
import ApiKey from "../models/ApiKey.js"
import AuditLog from "../models/AuditLog.js"

// Get all API keys for organization
export const getApiKeys = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, isActive } = req.query

  // Build query with tenant isolation
  const query = { organizationId: req.organizationId }

  // Add active filter if specified
  if (isActive !== undefined) {
    query.isActive = isActive === "true"
  }

  const apiKeys = await ApiKey.find(query)
    .populate("createdBy", "firstName lastName email")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })

  const total = await ApiKey.countDocuments(query)

  successResponse(res, {
    apiKeys,
    pagination: {
      current: Number.parseInt(page),
      pages: Math.ceil(total / limit),
      total,
    },
  })
})

// Get single API key
export const getApiKey = asyncHandler(async (req, res) => {
  const { keyId } = req.params

  const apiKey = await ApiKey.findOne({
    _id: keyId,
    organizationId: req.organizationId, // Tenant isolation
  }).populate("createdBy", "firstName lastName email")

  if (!apiKey) {
    return errorResponse(res, "API key not found", 404)
  }

  successResponse(res, { apiKey })
})

// Generate new API key
export const createApiKey = asyncHandler(async (req, res) => {
  const { name, permissions = ["read"], scopes = [], expiresIn } = req.body

  // Validate permissions
  const validPermissions = ["read", "write", "admin"]
  const invalidPermissions = permissions.filter((p) => !validPermissions.includes(p))
  if (invalidPermissions.length > 0) {
    return errorResponse(res, `Invalid permissions: ${invalidPermissions.join(", ")}`, 400)
  }

  // Validate scopes
  const validScopes = ["users", "projects", "organizations", "audit"]
  const invalidScopes = scopes.filter((s) => !validScopes.includes(s))
  if (invalidScopes.length > 0) {
    return errorResponse(res, `Invalid scopes: ${invalidScopes.join(", ")}`, 400)
  }

  // Only admin users can create API keys with admin permissions
  if (permissions.includes("admin") && req.user.role !== "admin") {
    return errorResponse(res, "Only admin users can create API keys with admin permissions", 403)
  }

  try {
    // Generate API key
    const { keyId, fullKey, hashedKey } = generateApiKey()

    // Calculate expiration date
    let expiresAt = null
    if (expiresIn) {
      const expirationMs = {
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
        "1y": 365 * 24 * 60 * 60 * 1000,
      }

      if (expirationMs[expiresIn]) {
        expiresAt = new Date(Date.now() + expirationMs[expiresIn])
      }
    }

    // Create API key record
    const apiKey = await ApiKey.create({
      name,
      keyId,
      hashedKey,
      organizationId: req.organizationId,
      createdBy: req.user._id,
      permissions,
      scopes,
      expiresAt,
    })

    await apiKey.populate("createdBy", "firstName lastName email")

    // Log API key generation
    await AuditLog.create({
      action: "API_KEY_GENERATED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        keyId,
        keyName: name,
        permissions,
        scopes,
        expiresAt,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`API key generated: ${name} by ${req.user.email}`)

    // Return the full key only once (it won't be stored)
    successResponse(
      res,
      {
        apiKey: {
          ...apiKey.toJSON(),
          fullKey, // This is the only time the full key is returned
        },
        warning: "This is the only time you'll see the full API key. Store it securely.",
      },
      "API key generated successfully",
      201,
    )
  } catch (error) {
    logger.error("API key generation error:", error)
    return errorResponse(res, "API key generation failed", 500)
  }
})

// Update API key
export const updateApiKey = asyncHandler(async (req, res) => {
  const { keyId } = req.params
  const { name, permissions, scopes, isActive } = req.body

  const apiKey = await ApiKey.findOne({
    _id: keyId,
    organizationId: req.organizationId, // Tenant isolation
  })

  if (!apiKey) {
    return errorResponse(res, "API key not found", 404)
  }

  // Only admin users can update API keys with admin permissions
  if (permissions && permissions.includes("admin") && req.user.role !== "admin") {
    return errorResponse(res, "Only admin users can set admin permissions", 403)
  }

  try {
    // Update fields
    if (name) apiKey.name = name
    if (permissions) apiKey.permissions = permissions
    if (scopes) apiKey.scopes = scopes
    if (isActive !== undefined) apiKey.isActive = isActive

    await apiKey.save()
    await apiKey.populate("createdBy", "firstName lastName email")

    // Log API key update
    await AuditLog.create({
      action: "API_KEY_UPDATED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        keyId: apiKey.keyId,
        keyName: apiKey.name,
        changes: { name, permissions, scopes, isActive },
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`API key updated: ${apiKey.name} by ${req.user.email}`)

    successResponse(res, { apiKey })
  } catch (error) {
    logger.error("API key update error:", error)
    return errorResponse(res, "API key update failed", 500)
  }
})

// Revoke API key
export const revokeApiKey = asyncHandler(async (req, res) => {
  const { keyId } = req.params

  const apiKey = await ApiKey.findOne({
    _id: keyId,
    organizationId: req.organizationId, // Tenant isolation
  })

  if (!apiKey) {
    return errorResponse(res, "API key not found", 404)
  }

  try {
    // Deactivate the API key
    apiKey.isActive = false
    await apiKey.save()

    // Log API key revocation
    await AuditLog.create({
      action: "API_KEY_REVOKED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        keyId: apiKey.keyId,
        keyName: apiKey.name,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`API key revoked: ${apiKey.name} by ${req.user.email}`)

    successResponse(res, null, "API key revoked successfully")
  } catch (error) {
    logger.error("API key revocation error:", error)
    return errorResponse(res, "API key revocation failed", 500)
  }
})

// Delete API key permanently
export const deleteApiKey = asyncHandler(async (req, res) => {
  const { keyId } = req.params

  const apiKey = await ApiKey.findOne({
    _id: keyId,
    organizationId: req.organizationId, // Tenant isolation
  })

  if (!apiKey) {
    return errorResponse(res, "API key not found", 404)
  }

  try {
    await ApiKey.findByIdAndDelete(keyId)

    // Log API key deletion
    await AuditLog.create({
      action: "API_KEY_DELETED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        keyId: apiKey.keyId,
        keyName: apiKey.name,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`API key deleted: ${apiKey.name} by ${req.user.email}`)

    successResponse(res, null, "API key deleted successfully")
  } catch (error) {
    logger.error("API key deletion error:", error)
    return errorResponse(res, "API key deletion failed", 500)
  }
})
