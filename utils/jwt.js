import jwt from "jsonwebtoken"
import { logger } from "./logger.js"

export const generateToken = (payload) => {
  try {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    })
  } catch (error) {
    logger.error("Error generating JWT token:", error)
    throw new Error("Token generation failed")
  }
}

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    logger.error("Error verifying JWT token:", error)
    throw error
  }
}

export const decodeToken = (token) => {
  try {
    return jwt.decode(token)
  } catch (error) {
    logger.error("Error decoding JWT token:", error)
    throw error
  }
}
