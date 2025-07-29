require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Base Zendesk API URL and basic auth  token
const ZENDESK_BASE = `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
const AUTH = Buffer.from(`${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_TOKEN}`).toString('base64');

// Create a new ticket
/**
 * ENHANCED TICKET CREATION WITH FEDERATED SEARCH
 * Creates a Zendesk ticket and optionally performs Help Center search
 * 
 * @route POST /api/ticket
 * @param {string} message - User's message content (with emoji markers)
 * @param {string} [user] - User identifier (defaults to 'Anonymous')
 * @param {string} [searchQuery] - Clean search query extracted from message
 * @param {boolean} [performSearch] - Whether to search Help Center (defaults to true)
 * 
 * Enhanced Features:
 * - Performs federated search on user's first message
 * - Returns both ticket information and relevant Help Center articles
 * - Maintains backward compatibility with existing ticket creation
 * - Adds automatic tagging and agent comments
 * - Handles search failures gracefully without blocking ticket creation
 * 
 * Workflow:
 * 1. If searchQuery provided, search Help Center articles
 * 2. Create Zendesk ticket with user message
 * 3. Add automatic agent comment about ticket creation
 * 4. Tag ticket with 'chatbot_new_ticket' for identification
 * 5. Return combined ticket and search result data
 * 
 * Backward Compatibility:
 * - All existing API calls continue to work unchanged
 * - Search functionality is additive and optional
 * - Existing response format is preserved with search results added
 */
app.post('/api/ticket', async (req, res) => {
  try {
    const { message, user, searchQuery, performSearch = true, skipTicketIfResults = false, email, name } = req.body;
    
    console.log(`📨 Incoming ticket request:`, {
      message: message?.substring(0, 100) + '...',
      user,
      email,
      name,
      searchQuery,
      performSearch,
      skipTicketIfResults,
      hasSearchQuery: !!searchQuery,
      hasUserInfo: !!(email && name)
    });
    
    let searchResults = null;
    let searchError = null;
    
    // PHASE 1: FEDERATED SEARCH INTEGRATION
    // If searchQuery is provided and search is enabled, search Help Center first
    if (searchQuery && searchQuery.trim() && performSearch) {
      try {
        console.log(`🔍 Performing federated search before ticket creation: "${searchQuery}"`);
        
        const searchResponse = await axios.get(
          `${ZENDESK_BASE}/help_center/articles/search.json`,
          {
            params: {
              query: searchQuery.trim(),
              locale: 'en-us', // TODO: Make configurable via environment variable
              per_page: 3 // Limit to top 3 results for chat interface
            },
            headers: {
              Authorization: `Basic ${AUTH}`,
              'Content-Type': 'application/json'
            },
            timeout: 3000 // Shorter timeout for inline search
          }
        );
        
        console.log(`🔍 Search API response:`, {
          status: searchResponse.status,
          resultCount: searchResponse.data?.results?.length || 0,
          totalCount: searchResponse.data?.count || 0
        });
        
        // Transform search results for frontend consumption
        searchResults = searchResponse.data.results.map(article => ({
          id: article.id,
          title: article.title,
          url: article.html_url,
          score: article.score,
          snippet: stripHtmlAndCreateSnippet(article.body, 150),
          section_id: article.section_id,
          locale: article.locale
        }));
        
        console.log(`✅ Federated search found ${searchResults.length} relevant articles`);
        
        // Check if we should skip ticket creation based on search results
        if (skipTicketIfResults && searchResults.length > 0) {
          console.log(`🚫 Skipping ticket creation - found ${searchResults.length} search results`);
          
          // Return search results without creating a ticket
          return res.json({
            ticketId: null,
            requesterId: null,
            searchResults: searchResults,
            searchPerformed: true,
            searchQuery: searchQuery,
            searchError: null,
            ticketSkipped: true,
            reason: 'Found relevant help articles',
            timestamp: new Date().toISOString(),
            features: {
              federatedSearch: true,
              conditionalTicketCreation: true
            }
          });
        }
        
      } catch (searchErr) {
        // Log search failure but continue with ticket creation
        console.error('⚠️ Federated search failed, continuing with ticket creation:', {
          query: searchQuery,
          error: searchErr.message,
          status: searchErr.response?.status
        });
        
        searchError = {
          message: 'Help Center search temporarily unavailable',
          details: searchErr.message
        };
      }
    } else {
      console.log(`❌ Skipping federated search:`, {
        hasSearchQuery: !!searchQuery,
        searchQueryTrim: searchQuery?.trim(),
        performSearch,
        reason: !searchQuery ? 'No search query' : !searchQuery.trim() ? 'Empty search query' : !performSearch ? 'Search disabled' : 'Unknown'
      });
    }

    // PHASE 2: ZENDESK TICKET CREATION
    // Create ticket using existing proven logic
    console.log(`🎫 Creating Zendesk ticket for user: ${name || user || 'Anonymous'}`);
    
    // Determine user information - prioritize provided name/email over defaults
    const ticketRequesterName = name || user || 'Anonymous';
    const ticketRequesterEmail = email || `${user || 'anon'}@example.com`;
    
    console.log(`👤 Ticket requester info:`, { 
      name: ticketRequesterName, 
      email: ticketRequesterEmail,
      source: email ? 'user-provided' : 'default'
    });
    
    const response = await axios.post(
      `${ZENDESK_BASE}/tickets.json`,
      {
        ticket: {
          subject: `Chat support request from ${ticketRequesterName}`,
          comment: { body: message },
          requester: {
            name: ticketRequesterName,
            email: ticketRequesterEmail
          },
          tags: ['chatbot_new_ticket', ...(email ? ['user_info_provided'] : ['default_user_info'])]
        }
      },
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const ticket = response.data.ticket;
    console.log(`✅ Created ticket #${ticket.id} for ${ticketRequesterName} (${ticketRequesterEmail})`);


    // PHASE 3: AUTOMATIC AGENT COMMENT
    // Add agent public comment after ticket creation (existing functionality)
    // PHASE 3: AUTOMATIC AGENT COMMENT
    // Add agent public comment after ticket creation (existing functionality)
    try {
      console.log(`💬 Adding automatic agent comment to ticket #${ticket.id}`);
      
      await axios.post(
        `${ZENDESK_BASE}/tickets/${ticket.id}/comments.json`,
        {
          ticket: {
            comment: {
              body: `Ticket number ${ticket.id} has been opened for you.`,
              public: true
            }
          }
        },
        {
          headers: {
            Authorization: `Basic ${AUTH}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Added agent comment to ticket #${ticket.id}`);
      
    } catch (err) {
      console.error(`⚠️ Failed to add agent comment to ticket #${ticket.id}:`, err.response?.data || err.message);
      // Don't block ticket creation if comment fails
    }

    // PHASE 4: AUTOMATIC TICKET TAGGING
    // Add chatbot_new_ticket tag to the ticket (existing functionality)
    try {
      console.log(`🏷️ Adding chatbot tag to ticket #${ticket.id}`);
      
      await axios.put(
        `${ZENDESK_BASE}/tickets/${ticket.id}.json`,
        {
          ticket: {
            tags: [ ...(ticket.tags || []), 'chatbot_new_ticket' ]
          }
        },
        {
          headers: {
            Authorization: `Basic ${AUTH}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`✅ Added chatbot tag to ticket #${ticket.id}`);
      
    } catch (err) {
      console.error(`⚠️ Failed to add chatbot tag to ticket #${ticket.id}:`, err.response?.data || err.message);
      // Don't block ticket creation if tag fails
    }

    // PHASE 5: ENHANCED RESPONSE WITH SEARCH RESULTS
    // Return enhanced response with both ticket data and search results
    const enhancedResponse = {
      // Existing response format (maintains backward compatibility)
      ticketId: ticket.id,
      requesterId: ticket.requester_id,
      
      // New federated search data (additive enhancement)
      searchResults: searchResults,
      searchPerformed: !!searchQuery && performSearch,
      searchQuery: searchQuery || null,
      searchError: searchError,
      
      // Additional metadata for analytics and debugging
      timestamp: new Date().toISOString(),
      features: {
        federatedSearch: true,
        autoTaging: true,
        agentComment: true
      }
    };
    
    console.log(`🚀 Ticket creation complete for #${ticket.id}`, {
      hasSearchResults: !!searchResults,
      searchResultCount: searchResults?.length || 0,
      searchQuery: searchQuery || 'none'
    });

    res.json(enhancedResponse);
    
  } catch (err) {
    // Enhanced error logging with federated search context
    console.error('❌ Ticket creation failed:', {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      searchQuery: req.body.searchQuery || 'none',
      user: req.body.user || 'Anonymous'
    });
    
    res.status(500).json({ 
      error: err.message,
      ticketId: null,
      requesterId: null,
      searchResults: null,
      searchPerformed: false,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * FEDERATED SEARCH ENDPOINT
 * Searches Zendesk Help Center articles using the federated search API
 * 
 * @route POST /api/search-help-center
 * @param {string} query - Search query from user message
 * @param {string} [locale] - Language locale (defaults to 'en-us')
 * @param {number} [per_page] - Number of results to return (defaults to 5)
 * @returns {Object} Search results with articles, metadata, and success status
 * 
 * Features:
 * - Searches across all published Help Center articles
 * - Returns structured article data with titles, URLs, and snippets
 * - Includes relevance scoring from Zendesk search engine
 * - Handles search failures gracefully without breaking ticket flow
 * - Truncates article bodies for performance and UI display
 * 
 * Error Handling:
 * - Returns 500 status for API failures
 * - Logs detailed error information for debugging
 * - Provides fallback error messages for frontend display
 */
app.post('/api/search-help-center', async (req, res) => {
  try {
    const { query, locale = 'en-us', per_page = 5 } = req.body;
    
    // Validate input parameters
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required and must be a non-empty string',
        articles: [],
        total: 0
      });
    }

    // Clean and prepare search query
    const cleanQuery = query.trim();
    
    console.log(`🔍 Searching Help Center for: "${cleanQuery}"`);
    
    // Execute Zendesk Help Center Search API request
    // Uses the federated search endpoint that searches across all published articles
    const searchResponse = await axios.get(
      `${ZENDESK_BASE}/help_center/articles/search.json`,
      {
        params: {
          query: cleanQuery,
          locale: locale,
          per_page: Math.min(per_page, 10) // Cap at 10 results for performance
        },
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout to prevent hanging
      }
    );

    // Transform raw Zendesk article data into structured format for frontend
    const articles = searchResponse.data.results.map(article => ({
      id: article.id,
      title: article.title || 'Untitled Article',
      body: stripHtmlAndCreateSnippet(article.body, 200),
      url: article.html_url,
      section_id: article.section_id,
      category_id: article.category_id,
      score: article.score || 0, // Zendesk relevance score
      locale: article.locale,
      created_at: article.created_at,
      updated_at: article.updated_at
    }));

    console.log(`✅ Found ${articles.length} articles for query: "${cleanQuery}"`);

    // Return structured response with search metadata
    res.json({
      success: true,
      query: cleanQuery,
      articles: articles,
      total: searchResponse.data.count || articles.length,
      locale: locale,
      search_time: new Date().toISOString()
    });

  } catch (err) {
    // Detailed error logging for debugging
    console.error('❌ Help Center search error:', {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });

    // Return user-friendly error response
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search Help Center articles',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      articles: [],
      total: 0
    });
  }
});

// Add a public comment as the requester via Requests API
// Add a public comment as the requester (end-user) or as agent (admin)
// Updated: Force deployment refresh to ensure comment endpoint is available
app.post('/api/ticket/:id/comment', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, userToken, user } = req.body;

    console.log(`💬 Adding comment to ticket #${id}:`, {
      hasMessage: !!message,
      hasUserToken: !!userToken,
      user: user || 'undefined',
      messagePreview: message?.substring(0, 50) + '...'
    });

    if (userToken) {
      // End-user comment via Requests API
      console.log(`👤 Adding end-user comment via Requests API`);
      const response = await axios.post(
        `${ZENDESK_BASE}/requests/${id}/comments.json`,
        { comment: { body: message, public: true } },
        {
          headers: {
            Authorization: `Basic ${userToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`✅ End-user comment added successfully`);
      return res.json({ success: true, comment: response.data.comment });
    } else {
      // STRATEGY: Use Requests API for end-user comments (more reliable than Tickets API)
      // Since we don't have userToken, we'll use the Requests API with admin auth
      // This approach works better for chat-based user comments
      console.log(`👤 Adding end-user comment via Requests API (admin auth)`);
      const response = await axios.post(
        `${ZENDESK_BASE}/requests/${id}/comments.json`,
        { comment: { body: message, public: true } },
        {
          headers: {
            Authorization: `Basic ${AUTH}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`✅ End-user comment added successfully via Requests API`);
      return res.json({ success: true, comment: response.data.comment });
    }
  } catch (err) {
    console.error(`❌ Failed to add comment to ticket #${req.params.id}:`, {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });
    res.status(500).json({ 
      error: err.message,
      details: err.response?.data || 'Comment posting failed'
    });
  }
});

// Add a private comment to a ticket (internal notes for agents)
app.post('/api/ticket/:id/private-comment', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, append = true } = req.body;
    
    console.log(`🔒 Adding private comment to ticket #${id}:`, {
      messageLength: message?.length || 0,
      append: append
    });

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    // Add timestamp to the message
    const timestamp = new Date().toLocaleString();
    const timestampedMessage = `[${timestamp}] ${message}`;

    // Add a private comment using Zendesk's comment API
    const response = await axios.post(
      `${ZENDESK_BASE}/tickets/${id}/comments.json`,
      { 
        ticket: { 
          comment: {
            body: timestampedMessage,
            public: false  // This makes it a private/internal comment
          }
        } 
      },
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ Private comment added successfully to ticket #${id}`);
    res.json({ 
      success: true, 
      message: 'Private comment added successfully',
      commentAdded: message
    });
    
  } catch (err) {
    console.error(`❌ Failed to add private comment to ticket #${req.params.id}:`, {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });
    res.status(500).json({ 
      error: err.message,
      details: err.response?.data || 'Private comment posting failed'
    });
  }
});

// Get comments for a ticket + return requester_id
app.get('/api/ticket/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📥 Fetching comments for ticket #${id}`);

    // Fetch comments
    const commentsResponse = await axios.get(
      `${ZENDESK_BASE}/tickets/${id}/comments.json`,
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Retrieved ${commentsResponse.data.comments?.length || 0} comments for ticket #${id}`);

    // Fetch ticket details to get requester_id
    const ticketResponse = await axios.get(
      `${ZENDESK_BASE}/tickets/${id}.json`,
      {
        headers: {
          Authorization: `Basic ${AUTH}`
        }
      }
    );

    console.log(`✅ Retrieved ticket details for #${id}, requester: ${ticketResponse.data.ticket.requester_id}`);

    res.json({
      comments: commentsResponse.data.comments,
      requester_id: ticketResponse.data.ticket.requester_id
    });
  } catch (err) {
    console.error(`❌ Failed to fetch comments for ticket #${req.params.id}:`, {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });
    res.status(500).json({ 
      error: err.message,
      details: err.response?.data || 'Failed to fetch comments'
    });
  }
});

// Add a new endpoint to solve (close) a ticket
app.post('/api/ticket/:id/solve', async (req, res) => {
  try {
    const { id } = req.params;
    // Update the ticket status to 'solved' in Zendesk
    const response = await axios.put(
      `${ZENDESK_BASE}/tickets/${id}.json`,
      {
        ticket: {
          status: 'solved'
        }
      },
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ success: true, ticket: response.data.ticket });
  } catch (err) {
    // Log the full Zendesk error response for debugging
    if (err.response && err.response.data) {
      console.error('Zendesk error:', JSON.stringify(err.response.data));
      // Return the full Zendesk error details to the frontend
      res.status(400).json({
        error: err.response.data.error || err.message,
        details: err.response.data.details || err.response.data,
        description: err.response.data.description || undefined
      });
    } else {
      console.error(err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

const PORT = process.env.PORT || 4000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'ChatbotMX Backend',
    version: '1.0.0'
  });
});

// Root endpoint for basic connectivity test
app.get('/', (req, res) => {
  res.json({ 
    message: 'ChatbotMX Backend API',
    status: 'Running',
    endpoints: [
      'POST /api/ticket - Create ticket with optional search',
      'POST /api/search-help-center - Search Help Center articles',
      'POST /api/ticket/:id/comment - Add comment to ticket',
      'GET /api/ticket/:id/comments - Get ticket comments',
      'POST /api/ticket/:id/solve - Close/solve ticket',
      'GET /health - Health check'
    ]
  });
});

/**
 * UTILITY FUNCTIONS FOR FEDERATED SEARCH
 * Helper functions to support search functionality
 */

/**
 * Extracts clean search query from user message
 * Removes emoji markers and common conversational words
 * 
 * @param {string} message - Raw user message with potential markers
 * @returns {string} Cleaned search query suitable for Help Center search
 */
function extractSearchQuery(message) {
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  // Remove emoji markers used for role detection
  let query = message
    .replace(/\s{6}💬/g, '') // Remove end user marker
    .replace(/\s{6}🙂/g, '') // Remove agent marker
    .trim();
  
  // Remove common conversational prefixes that don't help search
  const conversationalPrefixes = [
    /^(hi|hello|hey)\s+/i,
    /^(can you help|help me|i need help)\s+/i,
    /^(please|could you)\s+/i,
    /^(i have a|i'm having)\s+/i
  ];
  
  conversationalPrefixes.forEach(pattern => {
    query = query.replace(pattern, '');
  });
  
  return query.trim();
}

/**
 * Validates search query for minimum quality requirements
 * 
 * @param {string} query - Search query to validate
 * @returns {boolean} True if query is suitable for search
 */
function isValidSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return false;
  }
  
  const cleanQuery = query.trim();
  
  // Minimum length requirement
  if (cleanQuery.length < 3) {
    return false;
  }
  
  // Reject queries that are just common words
  const commonWords = ['help', 'issue', 'problem', 'question', 'support'];
  if (commonWords.includes(cleanQuery.toLowerCase())) {
    return false;
  }
  
  return true;
}

/**
 * Strips HTML tags and cleans up text for display
 * Converts HTML content to clean, readable text snippets
 * 
 * @param {string} htmlText - Raw HTML text content
 * @param {number} maxLength - Maximum length of returned snippet
 * @returns {string} Clean text snippet without HTML tags
 */
function stripHtmlAndCreateSnippet(htmlText, maxLength = 150) {
  if (!htmlText || typeof htmlText !== 'string') {
    return 'No preview available';
  }
  
  // Remove HTML tags
  let cleanText = htmlText
    .replace(/<[^>]*>/g, ' ')           // Remove all HTML tags
    .replace(/&nbsp;/g, ' ')           // Replace non-breaking spaces
    .replace(/&amp;/g, '&')            // Replace HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')              // Replace multiple spaces with single space
    .trim();                           // Remove leading/trailing whitespace
  
  // Truncate to desired length and add ellipsis if needed
  if (cleanText.length > maxLength) {
    // Try to break at word boundary
    const truncated = cleanText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.7) {
      // If we can break at a word boundary reasonably close to the end
      cleanText = truncated.substring(0, lastSpaceIndex) + '...';
    } else {
      // Otherwise just truncate at character boundary
      cleanText = truncated + '...';
    }
  }
  
  return cleanText || 'No preview available';
}

/**
 * SERVER STARTUP WITH ENHANCED LOGGING
 * Starts the Express server with comprehensive startup information
 */
app.listen(PORT, () => {
  console.log(`
🚀 ChatbotMX Backend Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Server: http://localhost:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🎫 Zendesk: ${process.env.ZENDESK_SUBDOMAIN || 'NOT_CONFIGURED'}.zendesk.com
📚 Features: 
   ✅ Ticket Creation & Management
   ✅ Federated Help Center Search  
   ✅ Real-time Comment Polling
   ✅ Automatic Tagging & Agent Comments
   ✅ Enhanced Error Handling & Logging
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Available Endpoints:
   POST /api/ticket                 - Create ticket (with optional search)
   POST /api/search-help-center     - Search Help Center articles  
   POST /api/ticket/:id/comment     - Add comment to ticket
   POST /api/ticket/:id/private-comment - Add private comment to ticket
   GET  /api/ticket/:id/comments    - Get ticket comments
   POST /api/ticket/:id/solve       - Close/solve ticket

🔍 Federated Search Integration: 
   • Searches Help Center on first user message
   • Returns relevant articles alongside ticket creation
   • Graceful fallback if search fails
   • Maintains full backward compatibility

Ready to handle chat requests! 💬
  `);
});
