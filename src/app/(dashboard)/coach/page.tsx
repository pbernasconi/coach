import type { Metadata } from 'next';
import CoachPage from '@/components/coach-chat/CoachPage';

export const metadata: Metadata = { title: 'Chat' };

/** The Coach chat full size (the panel's expand button): the same chat as the side panel. */
export default function Page() {
  return <CoachPage />;
}
