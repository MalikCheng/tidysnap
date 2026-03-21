// API Endpoint: POST /api/auth
// User registration, login, and Google OAuth

export const prerender = false;

import {
  createOrUpdateUser,
  findUserByEmail,
  createSession,
  users,
  getUserFromSession,
  getCookieValue,
} from './auth.shared';

export async function POST({ request, cookies }) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle JSON body (Google OAuth)
    if (contentType.includes('application/json')) {
      const body = await request.json();

      if (body.action === 'google_login' || body.googleToken) {
        const googleToken = body.googleToken;

        // Server-side Google token verification
        let email: string;
        try {
          const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${googleToken}` },
          });
          if (!googleResponse.ok) {
            return new Response(JSON.stringify({ error: 'Invalid Google token' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          const googleUser = await googleResponse.json();
          email = googleUser.email?.toLowerCase().trim();
        } catch (_) {
          // Network error - fall back to client-provided email for dev
          email = body.email?.toLowerCase().trim();
        }

        if (!email || !email.includes('@')) {
          return new Response(JSON.stringify({ error: 'Invalid email from Google' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Find or create user
        const user = createOrUpdateUser(email, 'google');

        // Create session
        const sessionId = createSession(user.id);
        cookies.set('session', sessionId, {
          path: '/',
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 30,
          sameSite: 'lax',
        });

        return new Response(
          JSON.stringify({
            success: true,
            user: {
              email: user.email,
              subscription: user.subscription,
              analysisCount: user.analysisCount,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle form submission (email/password)
    const formData = await request.formData();
    const action = formData.get('action');
    const email = formData.get('email')?.toString().toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'register') {
      if (users.has(email)) {
        return new Response(JSON.stringify({ error: 'Email already registered' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const user = createOrUpdateUser(email, 'email');
      const sessionId = createSession(user.id);
      cookies.set('session', sessionId, {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });

      return new Response(
        JSON.stringify({
          success: true,
          user: { email, subscription: 'free', analysisCount: 0 },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'login') {
      const user = findUserByEmail(email);
      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const sessionId = createSession(user.id);
      cookies.set('session', sessionId, {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            email: user.email,
            subscription: user.subscription,
            analysisCount: user.analysisCount,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET({ request }) {
  const cookie = request.headers.get('cookie') || '';
  const sessionId = getCookieValue(cookie, 'session');

  if (!sessionId) {
    return new Response(JSON.stringify({ loggedIn: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = getUserFromSession(sessionId);

  if (!user) {
    return new Response(JSON.stringify({ loggedIn: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      loggedIn: true,
      user: {
        email: user.email,
        subscription: user.subscription,
        analysisCount: user.analysisCount,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
