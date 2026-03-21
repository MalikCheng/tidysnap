// API Endpoint: POST /api/webhook
// Handle Stripe webhook events

export const prerender = false;

import Stripe from 'stripe';
import { upgradeToLifetime, createOrUpdateUser } from './auth.shared';

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

      console.log('[Webhook] Payment successful for:', email);

      // Ensure user exists (may not be in memory on cold start),
      // then upgrade to lifetime subscription
      if (email) {
        try {
          await createOrUpdateUser(email, 'stripe_checkout');
          const updated = await upgradeToLifetime(email);
          if (updated) {
            console.log(`[Webhook] User ${email} upgraded to lifetime`);
          } else {
            console.error(`[Webhook] Failed to upgrade user ${email}`);
          }
        } catch (err) {
          console.error('[Webhook] Error updating subscription:', err.message);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log('[Webhook] Subscription canceled:', subscription.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('[Webhook] Payment failed for:', invoice.customer_email);
      break;
    }

    default:
      console.log('[Webhook] Unhandled event type:', event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
