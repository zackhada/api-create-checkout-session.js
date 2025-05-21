// Serverless function for Stripe checkout with dynamic pricing
// Deploy this to Vercel, Netlify Functions, or similar platform

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// For Vercel
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { monthlyTotal, setupTotal, success_url, cancel_url } = req.body;

    // Validate inputs
    if (typeof monthlyTotal !== 'number' || typeof setupTotal !== 'number') {
      return res.status(400).json({ error: 'Invalid amounts provided' });
    }

    const lineItems = [];
    const sessionParams = {
      payment_method_types: ['card'],
      success_url: success_url || process.env.SUCCESS_URL || 'https://your-website.com/success',
      cancel_url: cancel_url || process.env.CANCEL_URL || 'https://your-website.com/cancel',
    };

    // Monthly subscription if applicable
    if (monthlyTotal > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Monthly Service Subscription',
            description: `Custom monthly service fee: $${monthlyTotal.toFixed(2)}/month`,
          },
          unit_amount: Math.round(monthlyTotal * 100), // Stripe uses cents
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      });
      
      // For subscriptions, use subscription mode
      sessionParams.mode = 'subscription';
    } else if (setupTotal > 0) {
      // If there's only a setup fee, use payment mode
      sessionParams.mode = 'payment';
    }

    // One-time setup fee if applicable
    if (setupTotal > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'One-time Setup Fee',
            description: 'Initial setup and onboarding fee',
          },
          unit_amount: Math.round(setupTotal * 100), // Stripe uses cents
        },
        quantity: 1,
      });
    }

    sessionParams.line_items = lineItems;

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    // Return the session ID to the client
    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe API error:', error);
    res.status(500).json({ error: error.message });
  }
}
