import { asyncHandler } from "../utils/asyncHandler.js"
import { successResponse, errorResponse } from "../utils/response.js"
import { logger } from "../utils/logger.js"
import Organization from "../models/Organization.js"
import User from "../models/User.js"
import AuditLog from "../models/AuditLog.js"

// Get organization details
export const getOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.organizationId)

  if (!organization) {
    return errorResponse(res, "Organization not found", 404)
  }

  // Get user count
  const userCount = await User.countDocuments({ organizationId: req.organizationId })

  successResponse(res, {
    organization: {
      ...organization.toObject(),
      userCount,
    },
  })
})

// Update organization (admin only)
export const updateOrganization = asyncHandler(async (req, res) => {
  const { name, description, domain, settings } = req.body

  try {
    const organization = await Organization.findById(req.organizationId)

    if (!organization) {
      return errorResponse(res, "Organization not found", 404)
    }

    // Update fields
    if (name) organization.name = name
    if (description !== undefined) organization.description = description
    if (domain !== undefined) organization.domain = domain
    if (settings) {
      organization.settings = { ...organization.settings, ...settings }
    }

    await organization.save()

    // Log organization update
    await AuditLog.create({
      action: "ORGANIZATION_UPDATED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        changes: { name, description, domain, settings },
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`Organization updated: ${organization.name} by ${req.user.email}`)

    successResponse(res, { organization })
  } catch (error) {
    logger.error("Organization update error:", error)
    return errorResponse(res, "Organization update failed", 500)
  }
})

// Get organization statistics (admin/manager only)
export const getOrganizationStats = asyncHandler(async (req, res) => {
  const [userStats, recentActivity] = await Promise.all([
    // User statistics
    User.aggregate([
      { $match: { organizationId: req.organizationId } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]),

    // Recent activity from audit logs
    AuditLog.find({ organizationId: req.organizationId })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate("userId", "firstName lastName email"),
  ])

  const stats = {
    users: {
      total: userStats.reduce((sum, stat) => sum + stat.count, 0),
      byRole: userStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count
        return acc
      }, {}),
    },
    recentActivity,
  }

  successResponse(res, { stats })
})
