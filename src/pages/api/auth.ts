// API Endpoint: POST /api/auth
// User registration, login, and Google OAuth

export const prerender = false;

import { v4 as uuidv4 } from 'uuid';

// Simple in-memory user store (for MVP - use Vercel KV or database in production)
const users = new Map();
const sessions = new Map();

// Cookie helpers
function getCookieValue(cookieString, name) {
  if (!cookieString) return null;
  const match = cookieString.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function createSession(userId) {
  const sessionId = uuidv4();
  sessions.set(sessionId, { userId, createdAt: Date.now() });
  return sessionId;
}

function getUserFromSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  // Find user by ID
  for (const user of users.values()) {
    if (user.id === session.userId) return user;
  }
  return null;
}

export async function POST({ request, cookies }) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Handle Google OAuth callback
    if (contentType.includes('application/json')) {
      const body = await request.json();
      
      if (body.action === 'google_login' || body.googleToken) {
        // Verify Google token and get user info
        const googleToken = body.googleToken;
        
        // In production, verify token with Google:
        // const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        //   headers: { 'Authorization': `Bearer ${googleToken}` }
        // });
        
        // For MVP, we'll accept the email from the client (in production, verify with Google)
        const email = body.email?.toLowerCase().trim();
        
        if (!email || !email.includes('@')) {
          return new Response(JSON.stringify({ error: 'Invalid email from Google' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Find or create user
        let user = users.get(email);
        if (!user) {
          const userId = uuidv4();
          user = {
            id: userId,
            email,
            createdAt: Date.now(),
            subscription: 'free',
            analysisCount: 0,
            provider: 'google'
          };
          users.set(email, user);
        }
        
        // Create session
        const sessionId = createSession(user.id);
        cookies.set('session', sessionId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
        
        return new Response(JSON.stringify({ 
          success: true, 
          user: { email: user.email, subscription: user.subscription, analysisCount: user.analysisCount }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle form submission (email/password)
    const formData = await request.formData();
    const action = formData.get('action');
    const email = formData.get('email')?.toString().toLowerCase().trim();
    
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'register') {
      if (users.has(email)) {
        return new Response(JSON.stringify({ error: 'Email already registered' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const userId = uuidv4();
      users.set(email, {
        id: userId,
        email,
        createdAt: Date.now(),
        subscription: 'free',
        analysisCount: 0,
        provider: 'email'
      });
      
      const sessionId = createSession(userId);
      cookies.set('session', sessionId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
      
      return new Response(JSON.stringify({ 
        success: true, 
        user: { email, subscription: 'free', analysisCount: 0 }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'login') {
      const user = users.get(email);
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const sessionId = createSession(user.id);
      cookies.set('session', sessionId, { path: '/', httpOnly: true, maxAge: 60 * 60 * 24 * 30 });
      
      return new Response(JSON.stringify({ 
        success: true, 
        user: { email: user.email, subscription: user.subscription, analysisCount: user.analysisCount }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET({ request }) {
  const cookie = request.headers.get('cookie') || '';
  const sessionId = getCookieValue(cookie, 'session');
  
  if (!sessionId) {
    return new Response(JSON.stringify({ loggedIn: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const user = getUserFromSession(sessionId);
  
  if (!user) {
    return new Response(JSON.stringify({ loggedIn: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ 
    loggedIn: true,
    user: { 
      email: user.email, 
      subscription: user.subscription, 
      analysisCount: user.analysisCount 
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
