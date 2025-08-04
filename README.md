# ChatbotMX Backend

Enhanced backend API for MaintainX chatbot with federated search integration.

## 🚀 Features

- **Zendesk Integration**: Full ticket creation and management
- **Federated Search**: Unified search via MXchatbot API with Zendesk fallback
- **Real-time Comments**: Polling and updates for live conversations
- **Secure Proxy**: Server-side API calls bypass CORS restrictions
- **Error Resilience**: Comprehensive error handling and fallback mechanisms

## 📦 Installation

### Local Development

```bash
# Clone and navigate to backend
cd chatbot-backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
# Add Zendesk and MXchatbot API credentials

# Start development server
npm start
```

### Production Deployment (Render.com)

1. **Connect Repository**: Link your GitHub repository to Render.com
2. **Environment Variables**: Add all required variables (see Configuration section)
3. **Deploy**: Automatic deployment on code changes
4. **Health Check**: Verify `https://your-app.onrender.com/health`

## ⚙️ Configuration

### Required Environment Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=4000

# Zendesk API (Required)
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=your-email@company.com
ZENDESK_API_TOKEN=your_zendesk_api_token_here

# MXchatbot Unified Search API (Required for federated search)
MXCHATBOT_API_URL=https://your-mxchatbot-api-url.com
MXCHATBOT_API_KEY=your_mxchatbot_api_key_here
```

### Optional Variables

```bash
# Search Configuration
SEARCH_LOCALE=en-us
SEARCH_DEFAULT_LIMIT=10

# Feature Flags
ENABLE_FEDERATED_SEARCH=true
ENABLE_SEARCH_FALLBACK=true
```

## 🔗 API Endpoints

### Core Endpoints

- `POST /api/ticket` - Create ticket with optional search
- `POST /api/search-help-center` - Search Zendesk Help Center
- `POST /api/search/federated` - **NEW** Unified search via MXchatbot
- `POST /api/ticket/:id/comment` - Add comment to ticket
- `GET /api/ticket/:id/comments` - Get ticket comments
- `POST /api/ticket/:id/solve` - Close/solve ticket
- `GET /health` - Health check

### NEW: Federated Search

```bash
curl -X POST https://your-backend.onrender.com/api/search/federated \
  -H "Content-Type: application/json" \
  -d '{
    "query": "password reset",
    "limit": 10,
    "filters": {
      "category": "authentication"
    }
  }'
```

## 🔒 Security Features

- **Server-side API Keys**: All sensitive credentials handled server-side
- **CORS Bypass**: Eliminates client-side CORS restrictions
- **Request Validation**: Input sanitization and validation
- **Rate Limiting Ready**: Structure supports rate limiting implementation
- **Error Sanitization**: Clean error responses without sensitive data

## 📊 Monitoring

### Health Check
```bash
curl https://your-backend.onrender.com/health
```

### Logs
Monitor application logs in Render.com dashboard for:
- Search performance metrics
- API call success/failure rates
- Error patterns and debugging info

## 🛠️ Development

### Project Structure

```
chatbot-backend/
├── index.js              # Main Express server
├── package.json          # Dependencies and scripts
├── .env.example          # Environment template
├── API_DOCUMENTATION.md  # Detailed API docs
└── README.md            # This file
```

### Key Functions

- **Federated Search**: `POST /api/search/federated`
- **Search Fallback**: Automatic Zendesk fallback if MXchatbot fails
- **Error Handling**: Comprehensive try-catch with detailed logging
- **HTML Processing**: Text extraction and snippet creation

### Adding New Features

1. Add endpoint to `index.js`
2. Update API documentation
3. Add environment variables if needed
4. Test locally then deploy

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured in Render.com
- [ ] MXchatbot API credentials tested
- [ ] Zendesk API credentials verified
- [ ] Health check endpoint working

### Post-deployment
- [ ] Test `/health` endpoint
- [ ] Test `/api/search/federated` with sample query
- [ ] Verify fallback to Zendesk search works
- [ ] Check logs for any errors

### Frontend Integration
- [ ] Update frontend to use new federated search endpoint
- [ ] Implement error handling for federated search failures
- [ ] Test end-to-end search functionality

## 📝 Changelog

### v1.2.0 (July 31, 2025)
- ✅ **NEW**: Federated search via MXchatbot Unified Search API
- ✅ **NEW**: Server-side proxy for CORS bypass
- ✅ **NEW**: Automatic fallback to Zendesk search
- ✅ **NEW**: Enhanced error handling and logging
- ✅ **NEW**: Environment configuration for MXchatbot API

### v1.1.0 (July 28, 2025)
- ✅ Enhanced ticket creation with Help Center search
- ✅ Search query processing and validation
- ✅ Comprehensive API documentation

### v1.0.0 (Initial Release)
- ✅ Basic Zendesk ticket creation
- ✅ Comment management
- ✅ Health check endpoints

## 🆘 Troubleshooting

### Common Issues

1. **MXchatbot API Authentication Failed**
   - Verify `MXCHATBOT_API_KEY` is correct
   - Check `MXCHATBOT_API_URL` format
   - Review Render.com environment variables

2. **Federated Search Returns Empty Results**
   - Check MXchatbot API status
   - Verify search query is valid (minimum 2 characters)
   - Monitor fallback to Zendesk search

3. **CORS Errors**
   - Ensure frontend calls backend `/api/search/federated` 
   - Do not call MXchatbot API directly from frontend

4. **Timeout Errors**
   - Check network connectivity to MXchatbot API
   - Verify 8-second timeout is appropriate
   - Monitor fallback mechanism activation

### Support

For technical issues:
1. Check Render.com logs
2. Review API documentation
3. Test endpoints individually
4. Verify environment configuration

---

**Backend Version**: 1.2.0  
**Last Updated**: July 31, 2025  
**Production URL**: https://chatbot-backend-mzzp.onrender.com
