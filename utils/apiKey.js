import crypto from "crypto"
import { logger } from "./logger.js"

export const generateApiKey = () => {
  try {
    const keyId = crypto.randomBytes(8).toString("hex")
    const keySecret = crypto.randomBytes(32).toString("hex")
    const fullKey = `ak_${keyId}_${keySecret}`
    const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex")

    return {
      keyId: `ak_${keyId}`,
      fullKey,
      hashedKey,
    }
  } catch (error) {
    logger.error("Error generating API key:", error)
    throw new Error("API key generation failed")
  }
}

export const hashApiKey = (apiKey) => {
  try {
    return crypto.createHash("sha256").update(apiKey).digest("hex")
  } catch (error) {
    logger.error("Error hashing API key:", error)
    throw new Error("API key hashing failed")
  }
}

export const validateApiKeyFormat = (apiKey) => {
  // API key format: ak_[8_hex_chars]_[64_hex_chars]
  const apiKeyRegex = /^ak_[a-f0-9]{16}_[a-f0-9]{64}$/
  return apiKeyRegex.test(apiKey)
}

export const extractKeyId = (apiKey) => {
  if (!validateApiKeyFormat(apiKey)) {
    return null
  }

  const parts = apiKey.split("_")
  return `ak_${parts[1]}`
}
