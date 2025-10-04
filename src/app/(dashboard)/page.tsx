'use client';

import { useUser } from '@clerk/nextjs';

export default function Dashboard() {
  const { isLoaded } = useUser();

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Welcome to your dashboard</h1>
      <p className="mt-2 text-gray-600">
        {'You are signed in.'}
      </p>
    </div>
  );
}
