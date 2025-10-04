'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  const { user } = useUser();

  return (
    <div className="px-4 sm:px-0">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName || 'Athlete'}!
        </h1>
        <p className="mt-2 text-gray-600">
          Your AI-powered training coach dashboard
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Training Plans"
          value="3"
          subtitle="Active plans"
          color="blue"
        />
        <StatCard
          title="Calendar Events"
          value="12"
          subtitle="This week"
          color="green"
        />
        <StatCard
          title="Strava Activities"
          value="8"
          subtitle="Last 7 days"
          color="orange"
        />
        <StatCard
          title="Weekly Volume"
          value="8.5h"
          subtitle="Training time"
          color="purple"
        />
      </div>

      {/* Connection Status */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Connected Services
        </h2>
        <div className="space-y-4">
          <ConnectionCard
            name="Google Calendar"
            status="connected"
            email="your.email@gmail.com"
            href="/calendar"
          />
          <ConnectionCard
            name="Strava"
            status="disconnected"
            href="/strava"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionButton
            title="Generate Training Plan"
            description="Create a new AI-powered weekly plan"
            href="/plan"
            icon="🎯"
          />
          <ActionButton
            title="Connect Calendar"
            description="Sync your Google Calendar events"
            href="/calendar"
            icon="📅"
          />
          <ActionButton
            title="Connect Strava"
            description="Import your activities from Strava"
            href="/strava"
            icon="🚴"
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-1">
            <dt className="text-sm font-medium text-gray-500 truncate">
              {title}
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {value}
            </dd>
            <dd className="mt-1 text-sm text-gray-500">{subtitle}</dd>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionCard({
  name,
  status,
  email,
  href,
}: {
  name: string;
  status: 'connected' | 'disconnected';
  email?: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
      <div className="flex items-center">
        <div
          className={`w-3 h-3 rounded-full mr-3 ${
            status === 'connected' ? 'bg-green-500' : 'bg-gray-300'
          }`}
        />
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          {email && <p className="text-sm text-gray-500">{email}</p>}
          {status === 'disconnected' && (
            <p className="text-sm text-gray-500">Not connected</p>
          )}
        </div>
      </div>
      <Link
        href={href}
        className="text-sm font-medium text-blue-600 hover:text-blue-500"
      >
        {status === 'connected' ? 'Manage' : 'Connect'}
      </Link>
    </div>
  );
}

function ActionButton({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  );
}
