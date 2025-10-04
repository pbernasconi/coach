'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export default function AdminPage() {
  const { user } = useUser();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConnections: 0,
    totalPlans: 0,
    totalEvents: 0,
  });

  // TODO: Fetch real stats from tRPC
  useEffect(() => {
    // Placeholder data
    setStats({
      totalUsers: 42,
      totalConnections: 38,
      totalPlans: 127,
      totalEvents: 1543,
    });
  }, []);

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          System overview and management tools
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <AdminStatCard title="Total Users" value={stats.totalUsers.toString()} />
        <AdminStatCard
          title="Calendar Connections"
          value={stats.totalConnections.toString()}
        />
        <AdminStatCard
          title="Training Plans"
          value={stats.totalPlans.toString()}
        />
        <AdminStatCard
          title="Calendar Events"
          value={stats.totalEvents.toString()}
        />
      </div>

      {/* System Health */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          System Health
        </h2>
        <div className="space-y-3">
          <HealthIndicator service="Database" status="healthy" />
          <HealthIndicator service="tRPC API" status="healthy" />
          <HealthIndicator service="Inngest Workflows" status="healthy" />
          <HealthIndicator service="Google Calendar API" status="healthy" />
          <HealthIndicator service="Strava API" status="healthy" />
          <HealthIndicator service="Anthropic AI" status="healthy" />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent Activity
        </h2>
        <div className="space-y-3">
          <ActivityItem
            action="Calendar sync completed"
            user="user@example.com"
            time="2 minutes ago"
          />
          <ActivityItem
            action="Training plan generated"
            user="athlete@example.com"
            time="15 minutes ago"
          />
          <ActivityItem
            action="New user registered"
            user="newuser@example.com"
            time="1 hour ago"
          />
          <ActivityItem
            action="Strava activities synced"
            user="runner@example.com"
            time="2 hours ago"
          />
        </div>
      </div>

      {/* Database Management */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Database Management
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Database Studio
              </h3>
              <p className="text-sm text-gray-500">
                View and manage database tables with Drizzle Studio
              </p>
            </div>
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              onClick={() => {
                // This would typically open drizzle studio
                alert('Run: npm run db:studio');
              }}
            >
              Open Studio
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Run Migrations
              </h3>
              <p className="text-sm text-gray-500">
                Apply pending database migrations
              </p>
            </div>
            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
              onClick={() => {
                alert('Run: npm run db:push');
              }}
            >
              Run Migrations
            </button>
          </div>
        </div>
      </div>

      {/* Background Jobs */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Background Jobs (Inngest)
        </h2>
        <div className="space-y-3">
          <JobStatus
            name="Calendar Sync"
            status="running"
            lastRun="5 minutes ago"
          />
          <JobStatus
            name="Strava Activity Sync"
            status="idle"
            lastRun="1 hour ago"
          />
          <JobStatus
            name="Weekly Plan Generation"
            status="scheduled"
            lastRun="3 hours ago"
          />
        </div>
      </div>
    </div>
  );
}

function AdminStatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
      </div>
    </div>
  );
}

function HealthIndicator({
  service,
  status,
}: {
  service: string;
  status: 'healthy' | 'warning' | 'error';
}) {
  const statusColors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center">
        <div className={`w-2 h-2 rounded-full mr-3 ${statusColors[status]}`} />
        <span className="text-sm font-medium text-gray-900">{service}</span>
      </div>
      <span className="text-sm text-gray-500 capitalize">{status}</span>
    </div>
  );
}

function ActivityItem({
  action,
  user,
  time,
}: {
  action: string;
  user: string;
  time: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{action}</p>
        <p className="text-xs text-gray-500">{user}</p>
      </div>
      <span className="text-xs text-gray-500">{time}</span>
    </div>
  );
}

function JobStatus({
  name,
  status,
  lastRun,
}: {
  name: string;
  status: 'running' | 'idle' | 'scheduled';
}) {
  const statusColors = {
    running: 'bg-blue-500',
    idle: 'bg-gray-400',
    scheduled: 'bg-yellow-500',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center">
        <div className={`w-2 h-2 rounded-full mr-3 ${statusColors[status]}`} />
        <div>
          <span className="text-sm font-medium text-gray-900">{name}</span>
          <p className="text-xs text-gray-500">Last run: {lastRun}</p>
        </div>
      </div>
      <span className="text-xs text-gray-500 capitalize">{status}</span>
    </div>
  );
}
