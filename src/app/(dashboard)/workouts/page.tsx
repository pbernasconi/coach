'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useUser } from '@clerk/nextjs';
import { type StravaActivity } from '@/db/schema';

export default function WorkoutsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const stravaConnectionsQuery = trpc.strava.getConnections.useQuery(
    { userId: user?.id || '' },
    { enabled: isLoaded && !!user?.id }
  );

  const activitiesQuery = trpc.strava.getUserActivities.useQuery(
    { userId: user?.id || '', limit: 50 },
    { enabled: isLoaded && !!user?.id }
  );

  const syncActivitiesMutation = trpc.strava.syncActivities.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      activitiesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to sync activities: ${error.message}`);
    },
  });

  const isStravaConnected = (stravaConnectionsQuery.data?.connections.length ?? 0) > 0;
  const activities = activitiesQuery.data?.activities ?? [];

  const handleConnectStrava = () => {
    router.push('/admin');
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

  const formatDistance = (meters: number | null) => {
    if (meters == null) return '-';
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  };

  const formatDuration = (seconds: number | null) => {
    if (seconds == null) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Workouts
        </h1>
        <p className="text-muted-foreground text-lg">
          View all your imported activities from Strava
        </p>
      </div>

      {/* Workouts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>
                Your workout history imported from Strava
              </CardDescription>
            </div>
            {isStravaConnected && (
              <Button
                onClick={handleSyncActivities}
                disabled={syncActivitiesMutation.isPending}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncActivitiesMutation.isPending ? 'animate-spin' : ''}`} />
                {syncActivitiesMutation.isPending ? 'Syncing...' : 'Sync Strava'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isStravaConnected ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workouts found</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Connect your Strava account to import your activities and see them here.
              </p>
              <Button onClick={handleConnectStrava}>Connect Strava</Button>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No activities yet</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Click &quot;Sync Strava&quot; to import your activities.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Elevation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity: StravaActivity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{activity.sportType || activity.type}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(activity.startDate)}</TableCell>
                    <TableCell className="text-right">{formatDistance(activity.distance)}</TableCell>
                    <TableCell className="text-right">{formatDuration(activity.movingTime)}</TableCell>
                    <TableCell className="text-right">{activity.totalElevationGain ? `${Math.round(activity.totalElevationGain)}m` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
