require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

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

// Check if API key is available
if (!process.env.GROK_API_KEY) {
  console.error('⚠️  WARNING: GROK_API_KEY is not set in environment variables');
  console.error('Please create a .env file in the backend directory with your Grok API key');
}

// Chat endpoint (Public - as per request to remove Firebase Admin from backend)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    console.log('Received message:', message);

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GROK_API_KEY) {
      return res.status(500).json({ 
        error: 'Grok API key is not configured.',
        details: 'Missing API key'
      });
    }

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
    
    // Increment API call counter
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (currentMonth !== lastResetDate) {
      apiCallCount = 0;
      lastResetDate = currentMonth;
    }
    apiCallCount++;
    
    res.json({ message: aiResponse });

  } catch (error) {
    console.error('Error:', error);
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'API quota exceeded', details: error.message });
    } else if (error.status === 401) {
      return res.status(401).json({ error: 'Invalid API key', details: error.message });
    } else {
      res.status(500).json({ 
        error: 'An error occurred while processing your request',
        details: error.message 
      });
    }
  }
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', apiCallCount });
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
 