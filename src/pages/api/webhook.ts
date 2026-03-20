// API Endpoint: POST /api/webhook
// Handle Stripe webhook events

export const prerender = false;

import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-01-27.acacia'
});

const WEBHOOK_SECRET = import.meta.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

export async function POST({ request }) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'No signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_email;
      const metadata = session.metadata;
      
      console.log('Payment successful for:', email);
      // TODO: Update user subscription in database
      // In production: Update Vercel KV or database
      
      break;
    }
    
    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log('Subscription canceled:', subscription.id);
      // TODO: Update user subscription status
      break;
    }
    
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('Payment failed for:', invoice.customer_email);
      // TODO: Handle failed payment
      break;
    }
    
    default:
      console.log('Unhandled event type:', event.type);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
