import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coach",
  description: "Training plan, Strava and Lift",
};

// Without Clerk keys the pages cannot sign in. The token routes (Lift sync, /api/home, cron, Strava
// webhook) do not use Clerk, so the app still builds and serves them.
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!clerkConfigured) {
    return (
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased p-8`}>
          <h1 className="text-xl font-semibold">Coach</h1>
          <p className="mt-2 text-sm">
            Sign-in is not set up: add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY on Vercel, then redeploy.
          </p>
        </body>
      </html>
    );
  }
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Toaster position="bottom-right" toastOptions={{
            classNames: {
              info: 'bg-blue-600 text-white border-blue-700',
            },
          }} />
        </body>
      </html>
    </ClerkProvider>
  );
}
