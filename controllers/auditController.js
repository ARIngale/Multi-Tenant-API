import { asyncHandler } from "../utils/asyncHandler.js"
import { successResponse, errorResponse } from "../utils/response.js"
import { logger } from "../utils/logger.js"
import AuditLog from "../models/AuditLog.js"

// Get audit logs with filtering and pagination
export const getAuditLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    action,
    userId,
    startDate,
    endDate,
    search,
    sortBy = "timestamp",
    sortOrder = "desc",
  } = req.query

  // Build query with tenant isolation
  const query = { organizationId: req.organizationId }

  // Add action filter
  if (action) {
    if (Array.isArray(action)) {
      query.action = { $in: action }
    } else {
      query.action = action
    }
  }

  // Add user filter
  if (userId) {
    query.userId = userId
  }

  // Add date range filter
  if (startDate || endDate) {
    query.timestamp = {}
    if (startDate) {
      query.timestamp.$gte = new Date(startDate)
    }
    if (endDate) {
      query.timestamp.$lte = new Date(endDate)
    }
  }

  // Add search filter (search in details)
  if (search) {
    query.$or = [
      { action: { $regex: search, $options: "i" } },
      { "details.email": { $regex: search, $options: "i" } },
      { "details.keyName": { $regex: search, $options: "i" } },
      { "details.projectName": { $regex: search, $options: "i" } },
      { ipAddress: { $regex: search, $options: "i" } },
    ]
  }

  // Build sort object
  const sort = {}
  sort[sortBy] = sortOrder === "desc" ? -1 : 1

  try {
    const auditLogs = await AuditLog.find(query)
      .populate("userId", "firstName lastName email")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sort)

    const total = await AuditLog.countDocuments(query)

    successResponse(res, {
      auditLogs,
      pagination: {
        current: Number.parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
      filters: {
        action,
        userId,
        startDate,
        endDate,
        search,
      },
    })
  } catch (error) {
    logger.error("Error fetching audit logs:", error)
    return errorResponse(res, "Failed to fetch audit logs", 500)
  }
})

// Get single audit log entry
export const getAuditLog = asyncHandler(async (req, res) => {
  const { logId } = req.params

  try {
    const auditLog = await AuditLog.findOne({
      _id: logId,
      organizationId: req.organizationId, // Tenant isolation
    }).populate("userId", "firstName lastName email")

    if (!auditLog) {
      return errorResponse(res, "Audit log entry not found", 404)
    }

    successResponse(res, { auditLog })
  } catch (error) {
    logger.error("Error fetching audit log:", error)
    return errorResponse(res, "Failed to fetch audit log", 500)
  }
})

// Get audit log statistics
export const getAuditStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - Number.parseInt(days))

    // Get action statistics
    const actionStats = await AuditLog.aggregate([
      {
        $match: {
          organizationId: req.organizationId,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ])

    // Get daily activity
    const dailyActivity = await AuditLog.aggregate([
      {
        $match: {
          organizationId: req.organizationId,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$timestamp",
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ])

    // Get top users by activity
    const topUsers = await AuditLog.aggregate([
      {
        $match: {
          organizationId: req.organizationId,
          timestamp: { $gte: startDate },
          userId: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$userId",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 10,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          count: 1,
          user: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
          },
        },
      },
    ])

    // Get failed login attempts
    const failedLogins = await AuditLog.countDocuments({
      organizationId: req.organizationId,
      action: "LOGIN_FAILED",
      timestamp: { $gte: startDate },
    })

    // Get API key usage
    const apiKeyUsage = await AuditLog.countDocuments({
      organizationId: req.organizationId,
      action: "API_KEY_USED",
      timestamp: { $gte: startDate },
    })

    const stats = {
      period: `${days} days`,
      actionStats,
      dailyActivity,
      topUsers,
      securityMetrics: {
        failedLogins,
        apiKeyUsage,
      },
    }

    successResponse(res, { stats })
  } catch (error) {
    logger.error("Error fetching audit statistics:", error)
    return errorResponse(res, "Failed to fetch audit statistics", 500)
  }
})

// Get available audit log actions
export const getAuditActions = asyncHandler(async (req, res) => {
  try {
    const actions = await AuditLog.distinct("action", {
      organizationId: req.organizationId,
    })

    successResponse(res, { actions: actions.sort() })
  } catch (error) {
    logger.error("Error fetching audit actions:", error)
    return errorResponse(res, "Failed to fetch audit actions", 500)
  }
})

// Export audit logs (admin only)
export const exportAuditLogs = asyncHandler(async (req, res) => {
  const { startDate, endDate, format = "json" } = req.query

  // Build query
  const query = { organizationId: req.organizationId }

  if (startDate || endDate) {
    query.timestamp = {}
    if (startDate) {
      query.timestamp.$gte = new Date(startDate)
    }
    if (endDate) {
      query.timestamp.$lte = new Date(endDate)
    }
  }

  try {
    const auditLogs = await AuditLog.find(query)
      .populate("userId", "firstName lastName email")
      .sort({ timestamp: -1 })
      .limit(10000) // Limit export to 10k records

    if (format === "csv") {
      // Convert to CSV format
      const csvHeader = "Timestamp,Action,User,Email,IP Address,User Agent,Details\n"
      const csvData = auditLogs
        .map((log) => {
          const user = log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : "System"
          const email = log.userId ? log.userId.email : ""
          const details = JSON.stringify(log.details).replace(/"/g, '""')
          return `"${log.timestamp}","${log.action}","${user}","${email}","${log.ipAddress || ""}","${log.userAgent || ""}","${details}"`
        })
        .join("\n")

      res.setHeader("Content-Type", "text/csv")
      res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${Date.now()}.csv"`)
      res.send(csvHeader + csvData)
    } else {
      // JSON format
      res.setHeader("Content-Type", "application/json")
      res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${Date.now()}.json"`)
      res.json({
        exportedAt: new Date().toISOString(),
        totalRecords: auditLogs.length,
        filters: { startDate, endDate },
        auditLogs,
      })
    }

    // Log the export action
    await AuditLog.create({
      action: "AUDIT_LOGS_EXPORTED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        format,
        recordCount: auditLogs.length,
        filters: { startDate, endDate },
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`Audit logs exported by ${req.user.email}: ${auditLogs.length} records`)
  } catch (error) {
    logger.error("Error exporting audit logs:", error)
    return errorResponse(res, "Failed to export audit logs", 500)
  }
})

// Delete old audit logs (admin only)
export const cleanupAuditLogs = asyncHandler(async (req, res) => {
  const { olderThanDays = 365 } = req.body

  if (olderThanDays < 90) {
    return errorResponse(res, "Cannot delete audit logs newer than 90 days", 400)
  }

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - Number.parseInt(olderThanDays))

    const result = await AuditLog.deleteMany({
      organizationId: req.organizationId,
      timestamp: { $lt: cutoffDate },
    })

    // Log the cleanup action
    await AuditLog.create({
      action: "AUDIT_LOGS_CLEANED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        deletedCount: result.deletedCount,
        olderThanDays,
        cutoffDate,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`Audit logs cleaned by ${req.user.email}: ${result.deletedCount} records deleted`)

    successResponse(res, {
      deletedCount: result.deletedCount,
      cutoffDate,
    })
  } catch (error) {
    logger.error("Error cleaning up audit logs:", error)
    return errorResponse(res, "Failed to cleanup audit logs", 500)
  }
})
