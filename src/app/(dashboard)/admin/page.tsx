'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, Activity, CheckCircle2, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

export default function AdminPage() {
  const { user, isLoaded } = useUser();

  const calendarConnectionsQuery = trpc.calendar.getConnections.useQuery(
    { userId: user?.id || '' },
    { enabled: isLoaded && !!user?.id }
  );

  const stravaConnectionsQuery = trpc.strava.getConnections.useQuery(
    { userId: user?.id || '' },
    { enabled: isLoaded && !!user?.id }
  );

  const calendarAuthUrlQuery = trpc.calendar.getAuthUrl.useQuery(
    { userId: user?.id || '' },
    { enabled: isLoaded && !!user?.id }
  );

  const stravaAuthUrlQuery = trpc.strava.getAuthUrl.useQuery(
    { state: user?.id || '' },
    { enabled: isLoaded && !!user?.id }
  );

  const isCalendarConnected = (calendarConnectionsQuery.data?.connections.length ?? 0) > 0;
  const isStravaConnected = (stravaConnectionsQuery.data?.connections.length ?? 0) > 0;

  const syncActivitiesMutation = trpc.strava.syncActivities.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      stravaConnectionsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to sync activities: ${error.message}`);
    },
  });

  const syncCalendarMutation = trpc.calendar.syncNow.useMutation({
    onSuccess: (data) => {
      calendarConnectionsQuery.refetch();
      if (data.success) {
        toast.success(`Successfully synced ${data.successfulSyncs} calendar(s)`);
      } else {
        toast.warning(`Synced with errors: ${data.failedSyncs} failed`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to sync calendar: ${error.message}`);
    },
  });

  const deleteCalendarMutation = trpc.calendar.deleteConnection.useMutation({
    onSuccess: () => {
      calendarConnectionsQuery.refetch();
      toast.success('Calendar connection deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete calendar: ${error.message}`);
    },
  });

  const handleStravaConnect = () => {
    if (stravaAuthUrlQuery.data?.authUrl) {
      window.location.href = stravaAuthUrlQuery.data.authUrl;
    }
  };

  const handleCalendarConnect = () => {
    if (calendarAuthUrlQuery.data?.authUrl) {
      window.location.href = calendarAuthUrlQuery.data.authUrl;
    }
  };

  const handleSyncActivities = () => {
    if (!user?.id) return;

    toast.info('Starting sync...', {
      description: 'This may take a few moments',
    });

    syncActivitiesMutation.mutate({
      userId: user.id,
      monthsBack: 6,
    });
  };

  const handleSyncCalendar = () => {
    if (!user?.id) return;

    toast.info('Syncing calendar...', {
      description: 'Fetching events from Google Calendar',
    });

    syncCalendarMutation.mutate({
      userId: user.id,
    });
  };

  const handleDeleteCalendar = (connectionId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete the calendar connection for ${email}?`)) {
      return;
    }

    deleteCalendarMutation.mutate({ connectionId });
  };

  const formatLastSync = (date: Date | string | null | undefined) => {
    if (!date) return 'Never';
    const syncDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground text-lg">
          Manage your integrations and connections
        </p>
      </div>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Connect and manage your third-party services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Calendar Integration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Google Calendar</p>
                    <Badge
                      variant="outline"
                      className={
                        isCalendarConnected
                          ? 'text-xs bg-green-50 border-green-600 text-green-700'
                          : 'text-xs'
                      }
                    >
                      {isCalendarConnected ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Connected
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Connected
                        </>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sync your calendar events to schedule training around your commitments
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isCalendarConnected && (
                  <Button
                    variant="outline"
                    onClick={handleSyncCalendar}
                    disabled={syncCalendarMutation.isPending}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-2 ${syncCalendarMutation.isPending ? 'animate-spin' : ''}`}
                    />
                    {syncCalendarMutation.isPending ? 'Syncing...' : 'Sync Calendar'}
                  </Button>
                )}
                <Button
                  onClick={handleCalendarConnect}
                  disabled={calendarAuthUrlQuery.isLoading || !calendarAuthUrlQuery.data?.authUrl}
                >
                  {calendarAuthUrlQuery.isLoading ? 'Loading...' : 'Connect Calendar'}
                </Button>
              </div>
            </div>

            {/* Connected Calendar Accounts */}
            {isCalendarConnected && (
              <div className="ml-16 space-y-2">
                {calendarConnectionsQuery.data?.connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="text-xs bg-green-50 border-green-600 text-green-700"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{connection.googleEmail}</p>
                        {connection.lastSyncedAt && (
                          <p className="text-xs text-muted-foreground">
                            Last synced: {formatLastSync(connection.lastSyncedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCalendar(connection.id, connection.googleEmail || 'this account')}
                      disabled={deleteCalendarMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Strava Integration */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Strava</p>
                  <Badge
                    variant="outline"
                    className={
                      isStravaConnected
                        ? 'text-xs bg-green-50 border-green-600 text-green-700'
                        : 'text-xs'
                    }
                  >
                    {isStravaConnected ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Connected
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Import your activities to track your training progress
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isStravaConnected && (
                <Button
                  variant="outline"
                  onClick={handleSyncActivities}
                  disabled={syncActivitiesMutation.isPending}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${syncActivitiesMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  {syncActivitiesMutation.isPending ? 'Syncing...' : 'Sync Activities'}
                </Button>
              )}
              {!isStravaConnected && (
                <Button
                  onClick={handleStravaConnect}
                  disabled={stravaAuthUrlQuery.isLoading || !stravaAuthUrlQuery.data?.authUrl}
                >
                  {stravaAuthUrlQuery.isLoading ? 'Loading...' : 'Connect'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
