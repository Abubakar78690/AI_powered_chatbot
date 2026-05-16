require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { authenticateFirebase, db } = require('./firebaseAdmin');

const app = express();

// Simple in-memory usage tracking
let apiCallCount = 0;
let lastResetDate = new Date().toISOString().slice(0, 7);
// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI client to point to Groq
const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
//The comment below is explaining that code below 
//is validating the API key Availability

// Comment=>Check if API key is available
if (!process.env.GROK_API_KEY) {
  console.error('⚠️  WARNING: GROK_API_KEY is not set in environment variables');
  console.error('Please create a .env file in the backend directory with your Grok API key');
}
// Usage check endpoint (protected)
app.get('/api/usage', authenticateFirebase, async (req, res) => {
  try {
    if (!process.env.GROK_API_KEY) {
      return res.status(500).json({ 
        error: 'Grok API key is not configured',
        details: 'Missing API key'
      });
    }

    // Get current date for usage check
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    console.log('Fetching usage for:', startOfMonth.toISOString().split('T')[0], 'to', endOfMonth.toISOString().split('T')[0]);

    try {
      const usage = await openai.usage.list({
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0]
      });

      console.log('OpenAI usage response:', usage);
      
      res.json({ 
        usage: usage.data || [],
        current_month: now.toISOString().slice(0, 7),
        local_count: apiCallCount
      });

    } catch (openaiError) {
      console.error('OpenAI usage API error:', openaiError);
      
      // If OpenAI usage API fails, return a fallback with basic info
      res.json({ 
        usage: [],
        current_month: now.toISOString().slice(0, 7),
        local_count: apiCallCount,
        error: 'Usage API not available',
        details: openaiError.message
      });
    }

  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({ 
      error: 'Failed to check usage',
      details: error.message 
    });
  }
});

// Chat endpoint (protected)
app.post('/api/chat', authenticateFirebase, async (req, res) => {
  try {
    const { message } = req.body;
    console.log('Received message:', message); // Debug log

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if API key is available
    if (!process.env.GROK_API_KEY) {
      console.log('API key missing!'); // Debug log
      return res.status(500).json({ 
        error: 'Grok API key is not configured. Please add GROK_API_KEY to your .env file.',
        details: 'Missing API key'
      });
    }
    
    console.log('API key found, length:', process.env.GROK_API_KEY.length); // Debug log

    console.log('Making Groq API call...'); // Debug log
    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are a helpful and friendly AI assistant. Provide clear, concise, and accurate responses."
        },
        {
          role: "user",
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('AI Response:', aiResponse); // Debug log
    
    // Store conversation in Firebase
    try {
      if (db) {
        await db.collection('messages').add({
          userId: req.user.uid,
          message: message,
          response: aiResponse,
          timestamp: new Date()
        });
        console.log('Message stored in Firestore successfully');
      }
    } catch (dbErr) {
      console.error('Error storing message in Firestore:', dbErr);
      // We don't fail the response if saving fails, but we log it
    }
    // Increment API call counter
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (currentMonth !== lastResetDate) {
      apiCallCount = 0;
      lastResetDate = currentMonth;
    }
    apiCallCount++;
    console.log('API call count:', apiCallCount);
    
    res.json({ message: aiResponse });

  } catch (error) {
    console.error('Error:', error);
    
    // Handle specific OpenAI API errors
    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'API quota exceeded - You have reached your OpenAI usage limit',
        details: error.message,
        type: 'quota_exceeded'
      });
    } else if (error.status === 401) {
      return res.status(401).json({ 
        error: 'Invalid API key - Please check your OpenAI API key',
        details: error.message,
        type: 'invalid_key'
      });
    } else if (error.status === 403) {
      return res.status(403).json({ 
        error: 'API access forbidden - Your account may be suspended or restricted',
        details: error.message,
        type: 'access_forbidden'
      });
    } else if (error.message && error.message.includes('insufficient_quota')) {
      return res.status(402).json({ 
        error: 'Credit expired - Your OpenAI account has insufficient credit. Please add funds to continue.',
        details: error.message,
        type: 'insufficient_credit'
      });
    } else if (error.message && error.message.includes('billing')) {
      return res.status(402).json({ 
        error: 'Billing issue - Please check your OpenAI billing and payment method.',
        details: error.message,
        type: 'billing_issue'
      });
    } else {
      res.status(500).json({ 
        error: 'An error occurred while processing your request',
        details: error.message,
        type: 'unknown_error'
      });
    }
  }
});

// Basic auth check route
app.get('/api/auth/me', authenticateFirebase, (req, res) => {
  res.json({ user: req.user });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something broke!',
    details: err.message 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 