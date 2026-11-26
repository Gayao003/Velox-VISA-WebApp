import { MasterLovConfig } from '../models/visa';
import {
  DEFAULT_STATIONS,
  DEFAULT_SHIFTS,
  DEFAULT_SOURCES,
  DEFAULT_DEPOSIT_TYPES,
  DEFAULT_PURPOSES,
  DEFAULT_PAYMENT_TYPES,
  DEFAULT_PRODUCTS,
  DEFAULT_READING_TYPES,
  DEFAULT_CREDIT_CUSTOMERS,
} from '../data/visaMasterData';
import { firestoreService } from './firestoreService';

const COL = 'master_lovs';
const DOC_ID = 'default';

export const getDefaultLovConfig = (): MasterLovConfig => ({
  id: DOC_ID,
  stations: [...DEFAULT_STATIONS],
  shifts: [...DEFAULT_SHIFTS],
  sources: [...DEFAULT_SOURCES],
  depositTypes: [...DEFAULT_DEPOSIT_TYPES],
  purposes: [...DEFAULT_PURPOSES],
  paymentTypes: [...DEFAULT_PAYMENT_TYPES],
  products: [...DEFAULT_PRODUCTS],
  readingTypes: [...DEFAULT_READING_TYPES],
  creditCustomers: [...DEFAULT_CREDIT_CUSTOMERS],
  updatedAt: new Date().toISOString(),
});

export const lovService = {
  subscribe(onData: (config: MasterLovConfig) => void): () => void {
    return firestoreService.subscribe<MasterLovConfig>(COL, (items) => {
      const found = items.find((i) => i.id === DOC_ID) || items[0];
      if (found) {
        onData({
          ...getDefaultLovConfig(),
          ...found,
        });
      } else {
        onData(getDefaultLovConfig());
      }
    });
  },

  async save(config: MasterLovConfig): Promise<void> {
    await firestoreService.save<MasterLovConfig>(COL, {
      ...config,
      id: DOC_ID,
      updatedAt: new Date().toISOString(),
    });
  },
};
