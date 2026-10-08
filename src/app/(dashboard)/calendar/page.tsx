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
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
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
  const [view, setView] = useState<View>('week');
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

  const handleSyncCalendar = (fullResync = false) => {
    if (!user?.id) return;

    toast.info(fullResync ? 'Full resync started...' : 'Syncing calendar...', {
      description: fullResync ? 'Fetching last 90 days of events' : 'Fetching recent changes',
    });

    syncCalendarMutation.mutate({
      userId: user.id,
      fullResync,
    });
  };

  // Generate consistent colors for each calendar connection
  const connectionColors = useMemo(() => {
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#F97316', // orange
    ];

    const colorMap = new Map<string, string>();
    calendarConnectionsQuery.data?.connections.forEach((conn, index) => {
      colorMap.set(conn.id, colors[index % colors.length]);
    });

    return colorMap;
  }, [calendarConnectionsQuery.data]);

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
        connectionId: event.connectionId,
        color: connectionColors.get(event.connectionId) || '#3B82F6',
      },
    }));
  }, [eventsQuery.data, startTime, endTime, connectionColors]);

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.resource?.htmlLink) {
      window.open(event.resource.htmlLink as string, '_blank');
    }
  };

  const handleSelectSlot = (slotInfo: { start: Date; end: Date; action: string }) => {
    console.log('Selected slot:', slotInfo);
    // Future: Open modal to create new event
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const baseColor = typeof event.resource?.color === 'string' ? event.resource.color : '#3B82F6';

    return {
      style: {
        backgroundColor: baseColor,
        borderRadius: '4px',
        color: 'white',
        border: 'none',
        padding: '4px 8px',
        fontSize: '0.75rem',
        fontWeight: '500',
        display: 'block',
        boxShadow: 'none',
      },
    };
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8">
      {/* Calendar View */}
      <Card className="flex flex-col flex-1 min-h-0 shadow-none rounded-none border-x-0">
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <CardTitle className="text-lg">Events</CardTitle>
              </div>
              <CardDescription className="hidden sm:block whitespace-nowrap text-xs">
                Your calendar events synced from Google Calendar
              </CardDescription>
            </div>
            {isCalendarConnected && (
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    handleSyncCalendar(true);
                  }}
                  disabled={syncCalendarMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw
                    className={`mr-1 h-3 w-3 ${syncCalendarMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  Full Resync
                </Button>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    handleSyncCalendar(false);
                  }}
                  disabled={syncCalendarMutation.isPending}
                  size="sm"
                >
                  <RefreshCw
                    className={`mr-1 h-3 w-3 ${syncCalendarMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  {syncCalendarMutation.isPending ? 'Syncing...' : 'Quick Sync'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
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
            <div className="flex-1 min-h-0">
              <style jsx global>{`
                /* Base calendar styles */
                .rbc-calendar {
                  font-size: 0.875rem;
                  font-family: inherit;
                }

                /* Header - day names */
                .rbc-header {
                  padding: 0.75rem 0.5rem;
                  font-size: 0.7rem;
                  font-weight: 600;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: hsl(var(--muted-foreground));
                  border-bottom: 1px solid hsl(var(--border));
                  background: transparent;
                }

                /* Date cells */
                .rbc-date-cell {
                  padding: 0.5rem;
                  font-size: 0.875rem;
                  font-weight: 500;
                  text-align: right;
                  color: hsl(var(--foreground));
                }

                .rbc-off-range {
                  color: hsl(var(--muted-foreground) / 0.5);
                }

                .rbc-off-range-bg {
                  background: transparent;
                }

                .rbc-today {
                  background-color: hsl(var(--accent) / 0.1);
                }

                /* Events */
                .rbc-event {
                  padding: 2px 6px;
                  font-size: 0.7rem;
                  line-height: 1.4;
                  margin: 1px 2px;
                  border-radius: 3px;
                  border: none !important;
                  font-weight: 500;
                }

                .rbc-event-label {
                  font-size: 0.65rem;
                  font-weight: 600;
                }

                .rbc-event-content {
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                }

                /* Month view */
                .rbc-month-view {
                  border: 1px solid hsl(var(--border));
                }

                .rbc-month-row {
                  border-top: 1px solid hsl(var(--border));
                  min-height: 100px;
                  overflow: visible;
                }

                .rbc-day-bg {
                  cursor: pointer;
                  transition: background-color 0.1s ease;
                }

                .rbc-day-bg:hover {
                  background-color: hsl(var(--accent) / 0.05);
                }

                .rbc-day-bg + .rbc-day-bg {
                  border-left: 1px solid hsl(var(--border));
                }

                .rbc-row-content {
                  z-index: 4;
                }

                /* Week/Day view */
                .rbc-time-view {
                  border: 1px solid hsl(var(--border));
                }

                .rbc-time-slot {
                  min-height: 15px;
                  border-top: 1px solid hsl(var(--border) / 0.2);
                }

                .rbc-day-slot .rbc-time-slot {
                  border-top: none;
                }

                .rbc-timeslot-group {
                  min-height: 30px;
                  border-top: none;
                }

                .rbc-time-header-gutter,
                .rbc-time-gutter {
                  font-size: 0.65rem;
                  color: hsl(var(--muted-foreground));
                  background: transparent;
                  font-weight: 500;
                }

                .rbc-label {
                  font-size: 0.65rem;
                  padding: 0 0.5rem;
                }

                .rbc-time-content {
                  border-top: 1px solid hsl(var(--border));
                }

                .rbc-current-time-indicator {
                  background-color: hsl(var(--primary));
                  height: 2px;
                }

                /* Toolbar */
                .rbc-toolbar {
                  padding: 0.75rem 0;
                  margin-bottom: 1rem;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                }

                .rbc-toolbar-label {
                  font-size: 1.125rem;
                  font-weight: 600;
                  color: hsl(var(--foreground));
                }

                .rbc-toolbar button {
                  padding: 0.375rem 0.75rem;
                  font-size: 0.875rem;
                  border: 1px solid hsl(var(--border));
                  background: hsl(var(--background));
                  color: hsl(var(--foreground));
                  border-radius: 0.375rem;
                  font-weight: 500;
                  transition: all 0.1s ease;
                }

                .rbc-toolbar button:hover {
                  background: hsl(var(--accent));
                }

                .rbc-toolbar button:active,
                .rbc-toolbar button.rbc-active {
                  background: hsl(var(--accent));
                  font-weight: 600;
                }

                /* Show more */
                .rbc-show-more {
                  font-size: 0.7rem;
                  color: hsl(var(--primary));
                  font-weight: 600;
                  padding: 0.125rem 0.375rem;
                  margin: 2px;
                }

                .rbc-show-more:hover {
                  text-decoration: underline;
                }
              `}</style>
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
                onSelectSlot={handleSelectSlot}
                selectable
                eventPropGetter={eventStyleGetter}
                components={{
                  event: ({ event }) => (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.75rem', lineHeight: '1.2' }}>
                        {event.title}
                      </div>
                      {(view === 'week' || view === 'day') && (
                        <div style={{
                          fontSize: '0.625rem',
                          opacity: 0.8,
                          marginTop: '2px',
                          fontWeight: 400
                        }}>
                          {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                        </div>
                      )}
                    </div>
                  ),
                }}
                style={{ height: '100%' }}
                views={['month', 'week', 'day', 'agenda']}
                popup
                defaultDate={new Date()}
                scrollToTime={new Date()}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
