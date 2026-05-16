const express = require('express');
const { auth, db } = require('../config/firebase');
const { generateToken } = require('../middleware/auth');
const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const router = express.Router();

// Signup endpoint (unchanged)
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    try {
      const existingUser = await auth.getUserByEmail(email);
      return res.status(400).json({ error: 'User with this email already exists' });
    } catch (error) {}
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: false
    });
    await db.collection('users').doc(userRecord.uid).set({
      name: name,
      email: email,
      createdAt: new Date(),
      lastLogin: new Date()
    });
    const token = generateToken(userRecord.uid, email);
    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName
      },
      token: token
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'User with this email already exists' });
    } else if (error.code === 'auth/invalid-email') {
      return res.status(400).json({ error: 'Invalid email format' });
    } else if (error.code === 'auth/weak-password') {
      return res.status(400).json({ error: 'Password is too weak' });
    }
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Login endpoint (updated)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    // Use Firebase Auth REST API to verify password
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        email,
        password,
        returnSecureToken: true
      }
    );
    // Get user info from Firestore (optional)
    let userData = { name: '', email: response.data.email };
    try {
      const userDoc = await db.collection('users').doc(response.data.localId).get();
      if (userDoc.exists) {
        userData = userDoc.data();
      }
    } catch (e) {}
    
    const token = generateToken(response.data.localId, response.data.email);
    res.json({
      message: 'Login successful',
      user: {
        id: response.data.localId,
        email: response.data.email,
        name: userData.name || response.data.displayName || ''
      },
      token: token
    });
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    return res.status(401).json({ error: 'Invalid email or password' });
  }
});

// Profile endpoint (unchanged)
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);
    const userDoc = await db.collection('users').doc(decoded.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userData = userDoc.data();
    res.json({
      user: {
        id: decoded.userId,
        email: decoded.email,
        name: userData.name,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Store user message and AI response
router.post('/message', async (req, res) => {
  const { user_id, message, response } = req.body;
  if (!user_id || !message || !response) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  try {
    await db.collection('messages').add({
      userId: user_id,
      message: message,
      response: response,
      timestamp: new Date()
    });
    res.status(201).json({ message: 'Message stored successfully!' });
  } catch (err) {
    return res.status(500).json({ message: 'Database error', error: err.message });
  }
});

// Chat endpoint: receives user_id and message, calls OpenAI, stores both, returns response
router.post('/chat', async (req, res) => {
  console.log('Chat endpoint hit with:', req.body);
  const { user_id, message } = req.body;
  if (!user_id || !message) {
    return res.status(400).json({ message: 'user_id and message are required.' });
  }
  
  // Debug log for API key
  console.log('API key found, length:', process.env.OPENAI_API_KEY?.length);
  
  try {
    // Call OpenAI API (v5.x syntax)
    console.log('Making OpenAI API call...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: message }
      ]
    });
    const aiResponse = completion.choices[0].message.content;
    console.log('AI Response:', aiResponse);
    
    // Store in DB
    console.log('Storing in database...');
    await db.collection('messages').add({
      userId: user_id,
      message: message,
      response: aiResponse,
      timestamp: new Date()
    });
    console.log('Message stored successfully');
    res.status(200).json({ response: aiResponse });
  } catch (err) {
    console.error('OpenAI or other error:', err);
    res.status(500).json({ message: 'OpenAI error', error: err.message });
  }
});

module.exports = router; 