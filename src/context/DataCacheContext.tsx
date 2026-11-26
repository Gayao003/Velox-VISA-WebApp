import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ShiftDepositRecord,
  ShiftCollectionRecord,
  MeterReadingRecord,
  BankPickupRecord,
  VdsRecord,
} from '../models/visa';
import { firestoreService } from '../services/firestoreService';

interface DataCacheContextValue {
  deposits: ShiftDepositRecord[];
  collections: ShiftCollectionRecord[];
  meterReadings: MeterReadingRecord[];
  bankPickups: BankPickupRecord[];
  vdsRecords: VdsRecord[];
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
  const [deposits, setDeposits] = useState<ShiftDepositRecord[]>(() =>
    readCached<ShiftDepositRecord>('shift_deposits')
  );
  const [collections, setCollections] = useState<ShiftCollectionRecord[]>(() =>
    readCached<ShiftCollectionRecord>('shift_collections')
  );
  const [meterReadings, setMeterReadings] = useState<MeterReadingRecord[]>(() =>
    readCached<MeterReadingRecord>('meter_readings')
  );
  const [bankPickups, setBankPickups] = useState<BankPickupRecord[]>(() =>
    readCached<BankPickupRecord>('bank_pickups')
  );
  const [vdsRecords, setVdsRecords] = useState<VdsRecord[]>(() =>
    readCached<VdsRecord>('vds_records')
  );

  useEffect(() => {
    const unsubDep = firestoreService.subscribe<ShiftDepositRecord>('shift_deposits', setDeposits);
    const unsubCol = firestoreService.subscribe<ShiftCollectionRecord>(
      'shift_collections',
      setCollections
    );
    const unsubMtr = firestoreService.subscribe<MeterReadingRecord>(
      'meter_readings',
      setMeterReadings
    );
    const unsubBpk = firestoreService.subscribe<BankPickupRecord>('bank_pickups', setBankPickups);
    const unsubVds = firestoreService.subscribe<VdsRecord>('vds_records', setVdsRecords);

    return () => {
      unsubDep();
      unsubCol();
      unsubMtr();
      unsubBpk();
      unsubVds();
    };
  }, []);

  return (
    <DataCacheContext.Provider
      value={{ deposits, collections, meterReadings, bankPickups, vdsRecords, isHydrated: true }}
    >
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
