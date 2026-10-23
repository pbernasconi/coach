/**
 * Sign Up Page
 * Renders Clerk's pre-built sign-up component
 */

import { SignUp } from '@clerk/nextjs';

// Email code only: Google sign-in has no OAuth credentials in the Clerk production instance, so its button fails.
const EMAIL_ONLY = { elements: { socialButtonsRoot: { display: 'none' }, dividerRow: { display: 'none' } } };
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign up' };

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp appearance={EMAIL_ONLY} />
    </div>
  );
}
