// API Endpoint: GET /api/subscription
// Check user subscription status

export const prerender = false;

import {
  getUserFromSession,
  getCookieValue,
} from './auth.shared';

export async function GET({ request }) {
  const cookie = request.headers.get('cookie') || '';
  const sessionId = getCookieValue(cookie, 'session');

  if (!sessionId) {
    return new Response(JSON.stringify({ loggedIn: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await getUserFromSession(sessionId);

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
