// API Endpoint: POST /api/webhook
// Handle Stripe webhook events

export const prerender = false;

import Stripe from 'stripe';
import { users, upgradeToLifetime } from './auth.shared';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-01-27.acacia',
});

const WEBHOOK_SECRET = import.meta.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

export async function POST({ request }) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_email?.toLowerCase().trim();
      const metadata = session.metadata;

      console.log('Payment successful for:', email);

      // Upgrade user to lifetime
      if (email) {
        const updated = upgradeToLifetime(email);
        if (updated) {
          console.log(`User ${email} upgraded to lifetime`);
        } else {
          // User might not be in memory (serverless cold start)
          // Check if we have user by scanning (not ideal but works for warm instances)
          let found = false;
          for (const [userEmail, user] of users.entries()) {
            if (userEmail.toLowerCase() === email) {
              user.subscription = 'lifetime';
              found = true;
              console.log(`User ${email} upgraded to lifetime (via scan)`);
              break;
            }
          }
          if (!found) {
            console.warn(`User ${email} not found in memory — may need manual upgrade or warm instance`);
          }
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log('Subscription canceled:', subscription.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('Payment failed for:', invoice.customer_email);
      break;
    }

    default:
      console.log('Unhandled event type:', event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
