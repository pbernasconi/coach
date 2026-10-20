import type { Metadata, Viewport } from "next";
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

// The icons are file conventions in this folder: icon.svg and favicon.ico (browser tabs), apple-icon.png (the iPhone
// home screen). manifest.ts names the app when it is added to a home screen.
export const metadata: Metadata = {
  title: { default: "Coach", template: "%s · Coach" },
  description: "Training plan, Strava and Lift",
  applicationName: "Coach",
  appleWebApp: { title: "Coach", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// Without Clerk keys the pages cannot sign in. The token routes (Lift sync, /api/home, cron, Strava
// webhook) do not use Clerk, so the app still builds and serves them.
const DARK_MODE_SCRIPT = `(() => {
  const m = window.matchMedia('(prefers-color-scheme: dark)');
  const set = () => document.documentElement.classList.toggle('dark', m.matches);
  set();
  m.addEventListener('change', set);
})();`;

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

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
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* The colour tokens switch on the .dark class; follow the system setting, before paint and on change. */}
          <script dangerouslySetInnerHTML={{ __html: DARK_MODE_SCRIPT }} />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Toaster position="bottom-right" toastOptions={{
            // Neutral, like the rest of the app: blue is the ride colour.
            classNames: {
              info: 'bg-foreground text-background border-foreground',
            },
          }} />
        </body>
      </html>
    </ClerkProvider>
  );
}
