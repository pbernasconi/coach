/**
 * Sign In Page
 * Renders Clerk's pre-built sign-in component
 */

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
