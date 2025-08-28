import mongoose from "mongoose"

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    domain: {
      type: String,
      lowercase: true,
      trim: true,
    },
    settings: {
      maxUsers: {
        type: Number,
        default: 50,
      },
      features: [
        {
          type: String,
          enum: ["projects", "analytics", "integrations", "advanced_security"],
        },
      ],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Create slug from name before saving
organizationSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
  }
  next()
})

export default mongoose.model("Organization", organizationSchema)
