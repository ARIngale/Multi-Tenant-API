import { asyncHandler } from "../utils/asyncHandler.js"
import { successResponse, errorResponse } from "../utils/response.js"
import { logger } from "../utils/logger.js"
import User from "../models/User.js"
import AuditLog from "../models/AuditLog.js"

// Get all users in organization (admin/manager only)
export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, search } = req.query

  // Build query with tenant isolation
  const query = { organizationId: req.organizationId }

  // Add role filter if specified
  if (role && ["user", "manager", "admin"].includes(role)) {
    query.role = role
  }

  // Add search filter
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ]
  }

  const users = await User.find(query)
    .select("-password")
    .populate("organizationId", "name slug")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })

  const total = await User.countDocuments(query)

  successResponse(res, {
    users,
    pagination: {
      current: Number.parseInt(page),
      pages: Math.ceil(total / limit),
      total,
    },
  })
})

// Get single user (admin/manager only, or own profile)
export const getUser = asyncHandler(async (req, res) => {
  const { userId } = req.params

  // Users can view their own profile, admin/manager can view any user in org
  if (req.user.role === "user" && userId !== req.user._id.toString()) {
    return errorResponse(res, "Access denied. You can only view your own profile.", 403)
  }

  const user = await User.findOne({
    _id: userId,
    organizationId: req.organizationId, // Tenant isolation
  })
    .select("-password")
    .populate("organizationId", "name slug")

  if (!user) {
    return errorResponse(res, "User not found", 404)
  }

  successResponse(res, { user })
})

// Create new user (admin only)
export const createUser = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, role = "user" } = req.body

  // Check if user already exists
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    return errorResponse(res, "User with this email already exists", 400)
  }

  // Validate role
  if (!["user", "manager", "admin"].includes(role)) {
    return errorResponse(res, "Invalid role specified", 400)
  }

  // Only admin can create other admins
  if (role === "admin" && req.user.role !== "admin") {
    return errorResponse(res, "Only admins can create other admin users", 403)
  }

  try {
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role,
      organizationId: req.organizationId, // Tenant isolation
    })

    // Log user creation
    await AuditLog.create({
      action: "USER_CREATED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        createdUserId: user._id,
        createdUserEmail: user.email,
        createdUserRole: user.role,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`User created: ${email} by ${req.user.email}`)

    successResponse(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
        },
      },
      "User created successfully",
      201,
    )
  } catch (error) {
    logger.error("User creation error:", error)
    return errorResponse(res, "User creation failed", 500)
  }
})

// Update user (admin/manager can update users, users can update themselves)
export const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params
  const { firstName, lastName, role, isActive } = req.body

  // Find user with tenant isolation
  const user = await User.findOne({
    _id: userId,
    organizationId: req.organizationId,
  })

  if (!user) {
    return errorResponse(res, "User not found", 404)
  }

  // Permission checks
  const isOwnProfile = userId === req.user._id.toString()
  const canUpdateOthers = ["admin", "manager"].includes(req.user.role)

  if (!isOwnProfile && !canUpdateOthers) {
    return errorResponse(res, "Access denied. You can only update your own profile.", 403)
  }

  // Role change restrictions
  if (role && role !== user.role) {
    if (req.user.role !== "admin") {
      return errorResponse(res, "Only admins can change user roles", 403)
    }

    if (role === "admin" && req.user.role !== "admin") {
      return errorResponse(res, "Only admins can promote users to admin", 403)
    }

    if (user.role === "admin" && req.user._id.toString() !== userId) {
      return errorResponse(res, "Admins can only change their own role", 403)
    }
  }

  // Status change restrictions
  if (isActive !== undefined && req.user.role !== "admin") {
    return errorResponse(res, "Only admins can activate/deactivate users", 403)
  }

  try {
    // Update allowed fields
    if (firstName) user.firstName = firstName
    if (lastName) user.lastName = lastName
    if (role && req.user.role === "admin") user.role = role
    if (isActive !== undefined && req.user.role === "admin") user.isActive = isActive

    await user.save()

    // Log user update
    await AuditLog.create({
      action: "USER_UPDATED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        updatedUserId: user._id,
        updatedUserEmail: user.email,
        changes: { firstName, lastName, role, isActive },
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`User updated: ${user.email} by ${req.user.email}`)

    successResponse(res, {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      },
    })
  } catch (error) {
    logger.error("User update error:", error)
    return errorResponse(res, "User update failed", 500)
  }
})

// Delete user (admin only)
export const deleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params

  // Find user with tenant isolation
  const user = await User.findOne({
    _id: userId,
    organizationId: req.organizationId,
  })

  if (!user) {
    return errorResponse(res, "User not found", 404)
  }

  // Prevent self-deletion
  if (userId === req.user._id.toString()) {
    return errorResponse(res, "You cannot delete your own account", 400)
  }

  try {
    await User.findByIdAndDelete(userId)

    // Log user deletion
    await AuditLog.create({
      action: "USER_DELETED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        deletedUserId: userId,
        deletedUserEmail: user.email,
        deletedUserRole: user.role,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`User deleted: ${user.email} by ${req.user.email}`)

    successResponse(res, null, "User deleted successfully")
  } catch (error) {
    logger.error("User deletion error:", error)
    return errorResponse(res, "User deletion failed", 500)
  }
})
