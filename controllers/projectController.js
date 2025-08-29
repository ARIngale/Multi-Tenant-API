import { asyncHandler } from "../utils/asyncHandler.js"
import { successResponse, errorResponse } from "../utils/response.js"
import { logger } from "../utils/logger.js"
import Project from "../models/Project.js"
import AuditLog from "../models/AuditLog.js"

// Get all projects (with tenant isolation)
export const getProjects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query

  // Build query with tenant isolation
  const query = { organizationId: req.organizationId }

  // Add status filter
  if (status && ["active", "inactive", "archived"].includes(status)) {
    query.status = status
  }

  // Add search filter
  if (search) {
    query.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
  }

  // Role-based filtering
  if (req.user.role === "user") {
    // Users can only see projects they're members of
    query["members.userId"] = req.user._id
  }

  const projects = await Project.find(query)
    .populate("createdBy", "firstName lastName email")
    .populate("members.userId", "firstName lastName email")
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })

  const total = await Project.countDocuments(query)

  successResponse(res, {
    projects,
    pagination: {
      current: Number.parseInt(page),
      pages: Math.ceil(total / limit),
      total,
    },
  })
})

// Get single project
export const getProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params

  const project = await Project.findOne({
    _id: projectId,
    organizationId: req.organizationId, // Tenant isolation
  })
    .populate("createdBy", "firstName lastName email")
    .populate("members.userId", "firstName lastName email")

  if (!project) {
    return errorResponse(res, "Project not found", 404)
  }

  // Check if user has access to this project
  if (req.user.role === "user") {
    const isMember = project.members.some((member) => member.userId._id.toString() === req.user._id.toString())
    if (!isMember) {
      return errorResponse(res, "Access denied. You are not a member of this project.", 403)
    }
  }

  successResponse(res, { project })
})

// Create new project
export const createProject = asyncHandler(async (req, res) => {
  const { name, description, members = [] } = req.body

  try {
    const project = await Project.create({
      name,
      description,
      organizationId: req.organizationId, // Tenant isolation
      createdBy: req.user._id,
      members: [
        {
          userId: req.user._id,
          role: "admin",
        },
        ...members.map((member) => ({
          userId: member.userId,
          role: member.role || "viewer",
        })),
      ],
    })

    await project.populate("createdBy", "firstName lastName email")
    await project.populate("members.userId", "firstName lastName email")

    // Log project creation
    await AuditLog.create({
      action: "PROJECT_CREATED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        projectId: project._id,
        projectName: project.name,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`Project created: ${name} by ${req.user.email}`)

    successResponse(res, { project }, "Project created successfully", 201)
  } catch (error) {
    logger.error("Project creation error:", error)
    return errorResponse(res, "Project creation failed", 500)
  }
})

// Update project
export const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params
  const { name, description, status, members } = req.body

  const project = await Project.findOne({
    _id: projectId,
    organizationId: req.organizationId, // Tenant isolation
  })

  if (!project) {
    return errorResponse(res, "Project not found", 404)
  }

  // Check permissions
  const isCreator = project.createdBy.toString() === req.user._id.toString()
  const isProjectAdmin = project.members.some(
    (member) => member.userId.toString() === req.user._id.toString() && member.role === "admin",
  )
  const canUpdate = req.user.role === "admin" || req.user.role === "manager" || isCreator || isProjectAdmin

  if (!canUpdate) {
    return errorResponse(res, "Access denied. You don't have permission to update this project.", 403)
  }

  try {
    // Update fields
    if (name) project.name = name
    if (description !== undefined) project.description = description
    if (status) project.status = status
    if (members) project.members = members

    await project.save()
    await project.populate("createdBy", "firstName lastName email")
    await project.populate("members.userId", "firstName lastName email")

    // Log project update
    await AuditLog.create({
      action: "PROJECT_UPDATED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        projectId: project._id,
        projectName: project.name,
        changes: { name, description, status, members },
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`Project updated: ${project.name} by ${req.user.email}`)

    successResponse(res, { project })
  } catch (error) {
    logger.error("Project update error:", error)
    return errorResponse(res, "Project update failed", 500)
  }
})

// Delete project
export const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params

  const project = await Project.findOne({
    _id: projectId,
    organizationId: req.organizationId, // Tenant isolation
  })

  if (!project) {
    return errorResponse(res, "Project not found", 404)
  }

  // Check permissions - only admin, manager, or project creator can delete
  const isCreator = project.createdBy.toString() === req.user._id.toString()
  const canDelete = req.user.role === "admin" || req.user.role === "manager" || isCreator

  if (!canDelete) {
    return errorResponse(res, "Access denied. You don't have permission to delete this project.", 403)
  }

  try {
    await Project.findByIdAndDelete(projectId)

    // Log project deletion
    await AuditLog.create({
      action: "PROJECT_DELETED",
      userId: req.user._id,
      organizationId: req.organizationId,
      details: {
        projectId,
        projectName: project.name,
      },
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    })

    logger.info(`Project deleted: ${project.name} by ${req.user.email}`)

    successResponse(res, null, "Project deleted successfully")
  } catch (error) {
    logger.error("Project deletion error:", error)
    return errorResponse(res, "Project deletion failed", 500)
  }
})
