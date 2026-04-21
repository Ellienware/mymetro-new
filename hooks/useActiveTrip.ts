// hooks/useActiveTrip.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

export interface ActiveTrip {
  id: string;
  provider: string;
  originStopName: string;
  startTime: string;
  status: 'in_progress';
}

export function useActiveTrip() {
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveTrip = useCallback(async () => {
    try {
      const data = await api.getActiveTrip() as ActiveTrip | null;
      setActiveTrip(data);
    } catch (err) {
      setActiveTrip(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveTrip();
    // Poll every 30 seconds? Or use WebSocket. For simplicity, just once.
  }, []);

  const clearActiveTrip = () => setActiveTrip(null);

  return { activeTrip, loading, refetch: fetchActiveTrip, clearActiveTrip };
}