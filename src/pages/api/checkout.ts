// API Endpoint: POST /api/checkout
// Create Stripe Checkout session for lifetime subscription

export const prerender = false;

import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-01-27.acacia'
});

const PRICE_ID = import.meta.env.STRIPE_PRICE_ID || 'price_placeholder';

export async function POST({ request, url }) {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString();
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
      success_url: `${url.origin}/dashboard?success=true`,
      cancel_url: `${url.origin}/dashboard?canceled=true`,
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
