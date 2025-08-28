import mongoose from "mongoose"
import crypto from "crypto"

const apiKeySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "API key name is required"],
      trim: true,
    },
    keyId: {
      type: String,
      required: true,
      unique: true,
    },
    hashedKey: {
      type: String,
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permissions: [
      {
        type: String,
        enum: ["read", "write", "admin"],
        default: "read",
      },
    ],
    scopes: [
      {
        type: String,
        enum: ["users", "projects", "organizations", "audit"],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsed: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
apiKeySchema.index({ organizationId: 1, isActive: 1 })
apiKeySchema.index({ keyId: 1 })
apiKeySchema.index({ hashedKey: 1 })

// Generate API key
apiKeySchema.statics.generateApiKey = () => {
  const keyId = crypto.randomBytes(8).toString("hex")
  const keySecret = crypto.randomBytes(32).toString("hex")
  const fullKey = `ak_${keyId}_${keySecret}`
  const hashedKey = crypto.createHash("sha256").update(fullKey).digest("hex")

  return {
    keyId: `ak_${keyId}`,
    fullKey,
    hashedKey,
  }
}

// Verify API key
apiKeySchema.statics.verifyApiKey = (providedKey) => {
  const hashedKey = crypto.createHash("sha256").update(providedKey).digest("hex")
  return hashedKey
}

// Transform output to hide sensitive data
apiKeySchema.methods.toJSON = function () {
  const apiKey = this.toObject()
  delete apiKey.hashedKey
  return apiKey
}

export default mongoose.model("ApiKey", apiKeySchema)
