'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useUser } from '@clerk/nextjs';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource?: Record<string, unknown>;
}

export default function CalendarPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  const calendarConnectionsQuery = trpc.calendar.getConnections.useQuery(
    { userId: user?.id || '' },
    { enabled: isLoaded && !!user?.id }
  );

  const isCalendarConnected = (calendarConnectionsQuery.data?.connections.length ?? 0) > 0;

  // Calculate date range for event query (last 60 days to 1 year from now)
  const { startTime, endTime } = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 60); // Last 60 days
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setFullYear(end.getFullYear() + 1); // 1 year from now
    end.setHours(23, 59, 59, 999);

    console.log('Calendar date range query:', {
      startTime: start,
      endTime: end,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    });

    return { startTime: start, endTime: end };
  }, []);

  const eventsQuery = trpc.calendar.getAllUserEvents.useQuery(
    {
      userId: user?.id || '',
      startTime,
      endTime,
    },
    { enabled: isLoaded && !!user?.id && isCalendarConnected }
  );

  const debugEventsQuery = trpc.calendar.debugEvents.useQuery(
    { userId: user?.id || '' },
    { enabled: false }
  );

  const handleDebug = async () => {
    const result = await debugEventsQuery.refetch();
    console.log('Debug events result:', result.data);
  };

  const syncCalendarMutation = trpc.calendar.syncNow.useMutation({
    onSuccess: (data) => {
      calendarConnectionsQuery.refetch();
      eventsQuery.refetch();
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

  const handleConnectCalendar = () => {
    router.push('/admin');
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

  // Transform calendar events for react-big-calendar
  const events: CalendarEvent[] = useMemo(() => {
    if (!eventsQuery.data?.events) {
      console.log('No events data available');
      return [];
    }

    console.log('Raw events from query:', eventsQuery.data.events.length);
    console.log('Date range:', { startTime, endTime });
    console.log('First 3 events:', eventsQuery.data.events.slice(0, 3).map(e => ({
      id: e.id,
      summary: e.summary,
      startTime: e.startTime,
      endTime: e.endTime,
    })));

    return eventsQuery.data.events.map((event) => ({
      id: event.id,
      title: event.summary || '(No title)',
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      allDay: event.isAllDay || false,
      resource: {
        description: event.description,
        location: event.location,
        status: event.status,
        htmlLink: event.htmlLink,
        hangoutLink: event.hangoutLink,
      },
    }));
  }, [eventsQuery.data, startTime, endTime]);

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.resource?.htmlLink) {
      window.open(event.resource.htmlLink as string, '_blank');
    }
  };

  return (
    <div className="space-y-10">
      {/* Calendar View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Events</CardTitle>
              <CardDescription>
                Your calendar events synced from Google Calendar
              </CardDescription>
            </div>
            {isCalendarConnected && (
              <div className="flex gap-2">
                <Button
                  onClick={handleDebug}
                  variant="outline"
                >
                  Debug Sept
                </Button>
                <Button
                  onClick={handleSyncCalendar}
                  disabled={syncCalendarMutation.isPending}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${syncCalendarMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  {syncCalendarMutation.isPending ? 'Syncing...' : 'Sync Calendar'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isCalendarConnected ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No calendar connected</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Connect your Google Calendar to view and sync your events here.
              </p>
              <Button onClick={handleConnectCalendar}>Connect Calendar</Button>
            </div>
          ) : eventsQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading events...</p>
            </div>
          ) : (
            <div className="h-[600px]">
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                onSelectEvent={handleSelectEvent}
                style={{ height: '100%' }}
                views={['month', 'week', 'day', 'agenda']}
                popup
                defaultDate={new Date()}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
