/**
 * tRPC Client Configuration
 * Client-side hooks for calling tRPC endpoints
 */

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

// Create typed React hooks
export const trpc = createTRPCReact<AppRouter>();
