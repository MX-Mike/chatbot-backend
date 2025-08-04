# ChatbotMX Backend API Documentation

## 🚀 Phase 1: Federated Search Integration

This document describes the enhanced API endpoints with federated Help Center search functionality.

## 📍 Base URL
```
https://chatbot-backend-mzzp.onrender.com/api
```

## 🔗 Enhanced API Endpoints

### 1. Enhanced Ticket Creation with Search
**POST** `/api/ticket`

Creates a Zendesk ticket and optionally performs federated Help Center search.

#### Request Body
```json
{
  "message": "I need help with password reset      💬",
  "user": "mike",
  "searchQuery": "password reset",
  "performSearch": true
}
```

#### Parameters
- `message` (string, required): User's message with emoji markers
- `user` (string, optional): User identifier (defaults to 'Anonymous')
- `searchQuery` (string, optional): Clean search query for Help Center
- `performSearch` (boolean, optional): Enable/disable search (defaults to true)

#### Enhanced Response
```json
{
  "ticketId": 12345,
  "requesterId": 67890,
  "searchResults": [
    {
      "id": 123,
      "title": "How to Reset Your Password",
      "url": "https://help.company.com/articles/123",
      "score": 95.5,
      "snippet": "Follow these steps to reset your password...",
      "section_id": 456,
      "locale": "en-us"
    }
  ],
  "searchPerformed": true,
  "searchQuery": "password reset",
  "searchError": null,
  "timestamp": "2025-07-28T11:30:00.000Z",
  "features": {
    "federatedSearch": true,
    "autoTaging": true,
    "agentComment": true
  }
}
```

#### Backward Compatibility
The response maintains all existing fields (`ticketId`, `requesterId`) while adding new search-related fields. Existing frontend implementations continue to work unchanged.

#### Error Response
```json
{
  "error": "Error message",
  "ticketId": null,
  "requesterId": null,
  "searchResults": null,
  "searchPerformed": false,
  "timestamp": "2025-07-28T11:30:00.000Z"
}
```

---

### 2. Dedicated Help Center Search
**POST** `/api/search-help-center`

Standalone endpoint for searching Help Center articles.

#### Request Body
```json
{
  "query": "password reset",
  "locale": "en-us",
  "per_page": 5
}
```

#### Parameters
- `query` (string, required): Search query
- `locale` (string, optional): Language locale (defaults to 'en-us')
- `per_page` (number, optional): Number of results (defaults to 5, max 10)

#### Response
```json
{
  "success": true,
  "query": "password reset",
  "articles": [
    {
      "id": 123,
      "title": "How to Reset Your Password",
      "body": "Follow these steps to reset your password safely and securely. First, navigate to the login page...",
      "url": "https://help.company.com/articles/123",
      "section_id": 456,
      "category_id": 789,
      "score": 95.5,
      "locale": "en-us",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2025-07-01T14:30:00Z"
    }
  ],
  "total": 15,
  "locale": "en-us",
  "search_time": "2025-07-28T11:30:00.000Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Search query is required and must be a non-empty string",
  "articles": [],
  "total": 0
}
```

---

### 3. Federated Search (NEW)
**POST** `/api/search/federated`

Server-side proxy for MXchatbot Unified Search API that bypasses CORS restrictions and handles authentication securely.

#### Request Body
```json
{
  "query": "password reset",
  "limit": 10,
  "filters": {
    "category": "authentication",
    "section": "user-accounts"
  }
}
```

#### Parameters
- `query` (string, required): Search term (minimum 2 characters)
- `limit` (number, optional): Maximum results to return (defaults to 10, max 50)
- `filters` (object, optional): Search filters for category, section, etc.

#### Response
```json
{
  "success": true,
  "results": [
    {
      "id": "article_123",
      "title": "How to Reset Your Password",
      "url": "https://help.getmaintainx.com/articles/password-reset",
      "snippet": "Follow these steps to reset your password safely and securely...",
      "score": 95.5,
      "source": "zendesk",
      "category": "Authentication",
      "section": "User Accounts",
      "last_updated": "2025-07-01T14:30:00Z"
    }
  ],
  "total": 25,
  "query": "password reset",
  "sources": ["zendesk", "docs", "knowledge_base"],
  "timestamp": "2025-07-31T11:30:00.000Z",
  "api_version": "federated_v1"
}
```

#### Fallback Response (if MXchatbot API fails)
```json
{
  "success": true,
  "results": [
    {
      "id": 123,
      "title": "How to Reset Your Password",
      "url": "https://help.company.com/articles/123",
      "snippet": "Follow these steps to reset your password...",
      "score": 89.2,
      "source": "zendesk_fallback",
      "category": null,
      "section": 456
    }
  ],
  "total": 5,
  "query": "password reset",
  "sources": ["zendesk_fallback"],
  "fallback": true,
  "original_error": "MXchatbot API timeout",
  "timestamp": "2025-07-31T11:30:00.000Z",
  "api_version": "federated_v1"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "Query must be at least 2 characters long",
  "query": "",
  "timestamp": "2025-07-31T11:30:00.000Z"
}
```

#### Features
- **Unified Search**: Searches across multiple knowledge sources via MXchatbot API
- **CORS Bypass**: Server-side proxy eliminates client-side CORS issues  
- **Secure Authentication**: API keys handled server-side, never exposed to frontend
- **Automatic Fallback**: Falls back to Zendesk-only search if MXchatbot API fails
- **Error Resilience**: Graceful error handling with detailed logging
- **Performance**: 8-second timeout with efficient result transformation

---

## 🔧 Implementation Features

### Search Query Processing
- **Automatic Cleaning**: Removes emoji markers and conversational prefixes
- **Validation**: Ensures queries meet minimum quality requirements
- **Timeout Protection**: 3-5 second timeouts prevent hanging requests

### Error Handling
- **Graceful Degradation**: Search failures don't break ticket creation
- **Detailed Logging**: Comprehensive error information for debugging
- **User-Friendly Messages**: Clean error responses for frontend display

### Performance Optimization
- **Result Limiting**: Caps search results for optimal chat UI
- **Timeout Management**: Prevents slow searches from blocking ticket creation
- **Efficient Caching**: Ready for future caching implementation

### Backward Compatibility
- **Existing APIs Unchanged**: All current endpoints work exactly as before
- **Response Format Preserved**: New fields are additive only
- **Feature Toggles**: Search can be disabled via `performSearch: false`

---

## 🧪 Testing the API

### Test Ticket Creation with Search
```bash
curl -X POST https://chatbot-backend-mzzp.onrender.com/api/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I reset my password?      💬",
    "user": "testuser",
    "searchQuery": "password reset"
  }'
```

### Test Standalone Search
```bash
curl -X POST https://chatbot-backend-mzzp.onrender.com/api/search-help-center \
  -H "Content-Type: application/json" \
  -d '{
    "query": "password reset",
    "per_page": 3
  }'
```

### Test Backward Compatibility
```bash
# This existing call continues to work unchanged
curl -X POST https://chatbot-backend-mzzp.onrender.com/api/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Need help      💬",
    "user": "mike"
  }'
```

---

## 📊 Search Integration Workflow

1. **User sends first message** in chat
2. **Frontend extracts search query** from message text
3. **Backend receives** ticket creation request with search query
4. **Federated search executes** against Help Center articles
5. **Ticket creation proceeds** normally (search doesn't block)
6. **Response includes** both ticket data and search results
7. **Frontend displays** relevant articles alongside chat

---

## 🔍 Query Processing Examples

| User Message | Extracted Query | Search Executed |
|-------------|----------------|-----------------|
| "Hi, I need help with password reset" | "password reset" | ✅ Yes |
| "How do I change my email?" | "change my email" | ✅ Yes |
| "Help" | "" | ❌ No (too short) |
| "I have a question about billing issues" | "billing issues" | ✅ Yes |

---

## ⚙️ Environment Configuration

### Required Environment Variables

#### Zendesk Configuration (Existing)
```bash
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=your-email@company.com
ZENDESK_API_TOKEN=your_zendesk_api_token_here
```

#### MXchatbot Configuration (NEW)
```bash
# Required for federated search functionality
MXCHATBOT_API_URL=https://your-mxchatbot-api-url.com
MXCHATBOT_API_KEY=your_mxchatbot_api_key_here
```

#### Optional Configuration
```bash
NODE_ENV=production
PORT=4000
SEARCH_LOCALE=en-us
SEARCH_DEFAULT_LIMIT=10
ENABLE_FEDERATED_SEARCH=true
ENABLE_SEARCH_FALLBACK=true
```

### Deployment Steps for Render.com

1. **Update Environment Variables**: Add the new MXchatbot variables in Render.com dashboard
2. **Deploy Backend**: Push updated code to trigger automatic deployment
3. **Test Endpoints**: Verify `/api/search/federated` endpoint functionality
4. **Monitor Logs**: Check for any authentication or connectivity issues

### Security Notes

- **API Keys**: Never expose MXchatbot API keys in frontend code
- **CORS**: Federated search bypasses CORS by using server-side proxy
- **Rate Limiting**: Consider implementing rate limiting for production use
- **Timeout Handling**: 8-second timeout prevents hanging requests

---

## 🚀 Next Steps (Phase 2)

- Frontend integration with search results display
- Search result interaction tracking
- Enhanced query extraction algorithms
- Search result caching for performance
- Multi-language support
- Analytics and success metrics

---

**Last Updated**: July 31, 2025
**API Version**: 1.2.0 (Enhanced with Federated Search via MXchatbot)
