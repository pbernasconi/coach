/**
 * Sign In Page
 * Renders Clerk's pre-built sign-in component under the Coach mark
 */

import { SignIn } from '@clerk/nextjs';
import CoachMark from '@/components/brand/CoachMark';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 px-4">
      <div className="flex items-center gap-2">
        <CoachMark className="size-8" />
        <span className="text-xl font-semibold tracking-tight">Coach</span>
      </div>
      <SignIn />
    </div>
  );
}
