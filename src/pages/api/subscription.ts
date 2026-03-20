// API Endpoint: GET /api/subscription
// Check user subscription status

export const prerender = false;

export async function GET({ request }) {
  // Get session cookie
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^| )session=([^;]+)/);
  
  if (!match) {
    return new Response(JSON.stringify({ loggedIn: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // TODO: Look up user in database using session
  // For now, return mock data
  
  return new Response(JSON.stringify({ 
    loggedIn: true,
    user: {
      email: 'user@example.com',
      subscription: 'lifetime',
      analysisCount: 5
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
