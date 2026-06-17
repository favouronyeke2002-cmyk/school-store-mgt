import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { shiftAPI } from '../lib/api';

interface Shift {
  id: number;
  user_id: number;
  opening_cash: number;
  expected_closing_cash: number | null;
  closing_cash: number | null;
  cash_difference: number | null;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
  username?: string;
}

interface ShiftContextType {
  activeShift: Shift | null;
  loading: boolean;
  openShift: (openingCash: number, userId: number) => Promise<boolean>;
  closeShift: (closingCash: number, userId: number) => Promise<{ expectedCash: number; difference: number } | null>;
  refreshShift: () => void;
}

const ShiftContext = createContext<ShiftContextType | null>(null);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshShift();
  }, []);

  const refreshShift = useCallback(async () => {
    try {
      const shift = await shiftAPI.getActive();
      setActiveShift(shift);
    } catch (err) {
      console.error('Failed to fetch active shift:', err);
    }
    setLoading(false);
  }, []);

  const openShift = useCallback(async (openingCash: number, userId: number): Promise<boolean> => {
    try {
      const result = await shiftAPI.open(userId, openingCash);
      if (result.success) {
        await refreshShift();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to open shift:', err);
      return false;
    }
  }, [refreshShift]);

  const closeShift = useCallback(async (closingCash: number, userId: number) => {
    if (!activeShift) return null;

    try {
      const result = await shiftAPI.close(activeShift.id, closingCash, userId);
      if (result.success) {
        setActiveShift(null);
        return { expectedCash: result.expectedCash, difference: result.difference };
      }
      return null;
    } catch (err) {
      console.error('Failed to close shift:', err);
      return null;
    }
  }, [activeShift]);

  return (
    <ShiftContext.Provider value={{ activeShift, loading, openShift, closeShift, refreshShift }}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const context = useContext(ShiftContext);
  if (!context) throw new Error('useShift must be used within ShiftProvider');
  return context;
}

export default ShiftContext;
