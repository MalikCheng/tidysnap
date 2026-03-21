// API Endpoint: POST /api/checkout
// Create Stripe Checkout session for lifetime subscription

export const prerender = false;

import Stripe from 'stripe';

// Initialize Stripe
const stripeSecretKey = import.meta.env.STRIPE_SECRET_KEY;
const PRICE_ID = import.meta.env.STRIPE_PRICE_ID;

if (!stripeSecretKey || stripeSecretKey === 'sk_test_placeholder') {
  console.warn('[Checkout] STRIPE_SECRET_KEY not configured — checkout will return error');
}

export async function POST({ request, url }) {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!stripeSecretKey || stripeSecretKey === 'sk_test_placeholder') {
      return new Response(
        JSON.stringify({
          error: 'Stripe is not configured yet. Please contact support to complete your purchase.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!PRICE_ID || PRICE_ID === 'price_placeholder') {
      return new Response(
        JSON.stringify({
          error: 'Product pricing not configured yet. Please contact support to complete your purchase.',
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-01-27.acacia' });

    // Create Stripe Checkout session for lifetime subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment for lifetime
      success_url: `${url.origin}/try?checkout=success`,
      cancel_url: `${url.origin}/try?checkout=canceled`,
      customer_email: email,
      metadata: {
        type: 'lifetime_subscription',
        email: email
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      url: session.url 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
