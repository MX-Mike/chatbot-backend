require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ZENDESK_BASE = `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2`;
const AUTH = Buffer.from(`${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_TOKEN}`).toString('base64');

// Create a new ticket
app.post('/api/ticket', async (req, res) => {
  try {
    const { message, user } = req.body;
    const response = await axios.post(
      `${ZENDESK_BASE}/tickets.json`,
      {
        ticket: {
          subject: `Chat from ${user || 'Anonymous'}`,
          comment: { body: message },
          requester: { name: user || 'Anonymous', email: `${user || 'anon'}@example.com` }
        }
      },
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ ticketId: response.data.ticket.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a comment to an existing ticket
app.post('/api/ticket/:id/comment', async (req, res) => {
  try {
    const { message } = req.body;
    const { id } = req.params;
    await axios.put(
      `${ZENDESK_BASE}/tickets/${id}.json`,
      { ticket: { comment: { body: message, public: true } } },
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get comments for a ticket (for polling agent replies)
app.get('/api/ticket/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(
      `${ZENDESK_BASE}/tickets/${id}/comments.json`,
      {
        headers: {
          Authorization: `Basic ${AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));