import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ShiftDepositRecord,
  ShiftCollectionRecord,
  MeterReadingRecord,
} from '../models/visa';
import { firestoreService } from '../services/firestoreService';

interface DataCacheContextValue {
  deposits: ShiftDepositRecord[];
  collections: ShiftCollectionRecord[];
  meterReadings: MeterReadingRecord[];
  isHydrated: boolean;
}

const DataCacheContext = createContext<DataCacheContextValue | null>(null);

function readCached<T>(col: string): T[] {
  try {
    const raw = localStorage.getItem(`visa_db_${col}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const DataCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Instant hydration from localStorage cache so switching pages has 0ms delay
  const [deposits, setDeposits] = useState<ShiftDepositRecord[]>(() =>
    readCached<ShiftDepositRecord>('shift_deposits')
  );
  const [collections, setCollections] = useState<ShiftCollectionRecord[]>(() =>
    readCached<ShiftCollectionRecord>('shift_collections')
  );
  const [meterReadings, setMeterReadings] = useState<MeterReadingRecord[]>(() =>
    readCached<MeterReadingRecord>('meter_readings')
  );
  const [isHydrated, setIsHydrated] = useState(true);

  useEffect(() => {
    const unsubDep = firestoreService.subscribe<ShiftDepositRecord>('shift_deposits', (data) => {
      setDeposits(data);
      setIsHydrated(true);
    });
    const unsubCol = firestoreService.subscribe<ShiftCollectionRecord>(
      'shift_collections',
      (data) => {
        setCollections(data);
        setIsHydrated(true);
      }
    );
    const unsubMtr = firestoreService.subscribe<MeterReadingRecord>('meter_readings', (data) => {
      setMeterReadings(data);
      setIsHydrated(true);
    });

    return () => {
      unsubDep();
      unsubCol();
      unsubMtr();
    };
  }, []);

  return (
    <DataCacheContext.Provider value={{ deposits, collections, meterReadings, isHydrated }}>
      {children}
    </DataCacheContext.Provider>
  );
};

export function useDataCache(): DataCacheContextValue {
  const ctx = useContext(DataCacheContext);
  if (!ctx) {
    throw new Error('useDataCache must be used inside DataCacheProvider');
  }
  return ctx;
}
