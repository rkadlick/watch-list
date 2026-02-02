import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

// Initialize Convex client for server-side usage
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('Missing CLERK_WEBHOOK_SECRET environment variable');
    return new Response('Server configuration error', { status: 500 });
  }

  // Get the headers (Next.js 15+ requires await)
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // Check for required Svix headers
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Missing required svix headers');
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get the raw body as text (required for signature verification)
  const payload = await req.text();

  // Create Webhook instance for verification
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the webhook signature
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Handle different event types
  const eventType = evt.type;
  console.log(`Received webhook: ${eventType} for user ${evt.data.id}`);

  try {
    if (eventType === 'user.created') {
      await convex.mutation(api.users.createUserFromWebhook, {
        clerkId: evt.data.id,
        email: evt.data.email_addresses[0]?.email_address || '',
        firstName: evt.data.first_name || undefined,
        lastName: evt.data.last_name || undefined,
        imageUrl: evt.data.image_url || undefined,
      });
      console.log(`✅ User created: ${evt.data.id}`);
    }

    if (eventType === 'user.updated') {
      await convex.mutation(api.users.updateUserFromWebhook, {
        clerkId: evt.data.id,
        email: evt.data.email_addresses[0]?.email_address || '',
        firstName: evt.data.first_name || undefined,
        lastName: evt.data.last_name || undefined,
        imageUrl: evt.data.image_url || undefined,
      });
      console.log(`✅ User updated: ${evt.data.id}`);
    }

    if (eventType === 'user.deleted') {
      await convex.mutation(api.users.deleteUserFromWebhook, {
        clerkId: evt.data.id!,
      });
      console.log(`✅ User deleted: ${evt.data.id}`);
    }

    return new Response('Webhook processed successfully', { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Error processing webhook', { status: 500 });
  }
}
