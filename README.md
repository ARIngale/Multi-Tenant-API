# Secure Multi-Tenant API with Express.js

A comprehensive, production-ready multi-tenant API built with Express.js, MongoDB, and JWT authentication. Features role-based access control, API key management, audit logging, and comprehensive security measures.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- npm or yarn

### Setup instructions 

# 1. Clone the repository
git clone https://github.com/ARIngale/Multi-Tenant-API.git
cd secure-multitenant-api

# 2. Install dependencies
npm install

# 3. Copy environment variables example and configure
cp .env
(Open .env and update values accordingly)


# 4. Start the development server
npm run start

## 🔧 Environment Variables

Create a `.env` file in the root directory:

\`\`\`env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/multitenant_api

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000

## 📚 API Documentation

### Base URL
\`\`\`
http://localhost:3000/api/v1
\`\`\`

### Authentication Endpoints

#### Register New User & Organization
\`\`\`http
POST /auth/register
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "My Company"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "admin@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "organization": {
        "id": "507f1f77bcf86cd799439012",
        "name": "My Company",
        "slug": "my-company"
      }
    }
  }
}
\`\`\`

#### Login
\`\`\`http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "SecurePassword123!"
}
\`\`\`

#### Get Profile
\`\`\`http
GET /auth/profile
Authorization: Bearer <token>
\`\`\`

### User Management Endpoints

#### Get All Users (Admin/Manager only)
\`\`\`http
GET /users?page=1&limit=10&role=user&search=john
Authorization: Bearer <token>
\`\`\`

#### Create User (Admin only)
\`\`\`http
POST /users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "user"
}
\`\`\`

#### Update User
\`\`\`http
PUT /users/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "manager",
  "isActive": true
}
\`\`\`

### Project Management Endpoints

#### Get Projects
\`\`\`http
GET /projects?page=1&limit=10&status=active&search=project
Authorization: Bearer <token>
\`\`\`

#### Create Project (Admin/Manager only)
\`\`\`http
POST /projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Project",
  "description": "Project description",
  "members": [
    {
      "userId": "507f1f77bcf86cd799439013",
      "role": "contributor"
    }
  ]
}
\`\`\`

### API Key Management Endpoints

#### Generate API Key (Admin/Manager only)
\`\`\`http
POST /api-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Integration API Key",
  "permissions": ["read", "write"],
  "scopes": ["projects", "users"],
  "expiresIn": "90d"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "API key generated successfully",
  "data": {
    "apiKey": {
      "id": "507f1f77bcf86cd799439014",
      "name": "Integration API Key",
      "keyId": "ak_1234567890abcdef",
      "permissions": ["read", "write"],
      "scopes": ["projects", "users"],
      "fullKey": "ak_1234567890abcdef_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    },
    "warning": "This is the only time you'll see the full API key. Store it securely."
  }
}
\`\`\`

#### List API Keys
\`\`\`http
GET /api-keys
Authorization: Bearer <token>
\`\`\`

#### Revoke API Key
\`\`\`http
PATCH /api-keys/:keyId/revoke
Authorization: Bearer <token>
\`\`\`

### External API Endpoints (API Key Authentication)

#### Get Projects (External)
\`\`\`http
GET /external/projects
X-API-Key: ak_1234567890abcdef_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
\`\`\`

#### Get Users (External)
\`\`\`http
GET /external/users
X-API-Key: <api-key>
\`\`\`

### Audit Log Endpoints

#### Get Audit Logs (Admin/Manager only)
\`\`\`http
GET /audit?page=1&limit=20&action=LOGIN_SUCCESS&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
\`\`\`

#### Get Audit Statistics
\`\`\`http
GET /audit/stats?days=30
Authorization: Bearer <token>
\`\`\`

#### Export Audit Logs (Admin only)
\`\`\`http
GET /audit/export?format=csv&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
\`\`\`

## 🔐 Authentication

### JWT Token Authentication

Include the JWT token in the Authorization header:
\`\`\`http
Authorization: Bearer <your-jwt-token>
\`\`\`

### API Key Authentication

For external integrations, use API key authentication:
\`\`\`http
X-API-Key: <your-api-key>
\`\`\`

Or in the Authorization header:
\`\`\`http
Authorization: Bearer <your-api-key>
\`\`\`
