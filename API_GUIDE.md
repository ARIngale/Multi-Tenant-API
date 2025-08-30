# API Usage Guide

## Quick Start Guide

### 1. Register and Get Token

\`\`\`bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "password": "SecurePassword123!",
    "firstName": "Atharva",
    "lastName": "Ingale",
    "organizationName": "My Company"
  }'
\`\`\`

Save the returned JWT token for authenticated requests.

### 2. Use Token for Authenticated Requests

\`\`\`bash
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
\`\`\`

### 3. Generate API Key for External Access

\`\`\`bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Integration",
    "permissions": ["read"],
    "scopes": ["projects"]
  }'
\`\`\`

### 4. Use API Key for External Requests

\`\`\`bash
curl -X GET http://localhost:3000/api/v1/external/projects \
  -H "X-API-Key: YOUR_API_KEY"
\`\`\`

## Error Handling

All API responses follow this format:

### Success Response
\`\`\`json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
\`\`\`

### Error Response
\`\`\`json
{
  "success": false,
  "message": "Error description",
  "errors": [ ... ] // Optional validation errors
}
\`\`\`


## Rate Limiting

Different endpoints have different rate limits:

- **Authentication**: 5 requests per 15 minutes
- **API Key Generation**: 10 requests per hour
- **General API**: 100 requests per 15 minutes

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time

## Pagination

List endpoints support pagination:

\`\`\`bash
GET /api/v1/users?page=1&limit=10
\`\`\`

Response includes pagination info:
\`\`\`json
{
  "data": {
    "users": [...],
    "pagination": {
      "current": 1,
      "pages": 5,
      "total": 50
    }
  }
}
\`\`\`

## Filtering and Search

Many endpoints support filtering:

\`\`\`bash
# Filter users by role
GET /api/v1/users?role=admin

# Search users
GET /api/v1/users?search=john

# Filter projects by status
GET /api/v1/projects?status=active

# Date range filtering for audit logs
GET /api/v1/audit?startDate=2024-01-01&endDate=2024-12-31
\`\`\`
