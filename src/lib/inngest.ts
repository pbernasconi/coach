/**
 * Inngest Client Configuration
 * Durable workflow execution for background jobs
 */

import { Inngest } from 'inngest';

// Create Inngest client
export const inngest = new Inngest({
  id: 'coach-app',
  name: 'Coach Training App',
});
