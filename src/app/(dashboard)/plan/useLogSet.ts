'use client';

import { toast } from 'sonner';
import type { LogSet } from '@/components/lift/LogSetForm';
import { editLiftAction } from './actions';

/** Logs one set of a Lift session from the web, then `onSaved` loads it again; a refusal shows as a toast. */
export function logSetWith(sessionId: string, unit: string, onSaved: () => Promise<void> | void): LogSet {
  return async (setId, reps, weight) => {
    try {
      const r = await editLiftAction(sessionId, [{ type: 'logSet', setId, reps, ...(weight !== undefined && { weight }), unit: unit === 'kg' ? 'kg' : 'lb' }]);
      if ('error' in r) toast.error(r.error);
      else await onSaved();
    } catch {
      toast.error('Could not log the set');
    }
  };
}
