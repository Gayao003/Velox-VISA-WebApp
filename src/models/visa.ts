export type UserRole = 'admin' | 'supervisor' | 'station_clerk';

export interface VisaUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  assignedStations: string[]; // ['All Stations'] or ['VLX-AG1', 'VLX-AG2']
  photoURL?: string;
  isActive: boolean;
  createdAt: string;
}

export interface DenominationEntry {
  denomination: number;
  pieces: number;
  amount: number;
}

export interface DsrRecord {
  id: string;
  dsrNo: string;
  // Header Information
  stationId: string;
  stationName: string;
  date: string; // YYYY-MM-DD
  shift: string;
  // Cash Accounting
  cashToBeAccounted: number;
  cashOnHand: number;
  variance: number;
  overShort: number;
  // Cashless Payments
  debit: number;
  credit: number;
  gcash: number;
  paymaya: number;
  // Credit Sales
  creditCustomerSales: number;
  prepaymentSales: number;
  fleetCardCustomer: number;
  fleetCardInterCompany: number;
  // Denomination
  denominations: DenominationEntry[];
  denominationTotal: number;
  // Meta
  status: 'draft' | 'submitted';
  notes?: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftDepositRecord {
  id: string;
  stationId: string;
  date: string;
  shift: string;
  depositSlipRef: string;
  source: string;
  amount: number;
  depositType: string;
  bankName: string;
  bankAccountNo: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftCollectionRecord {
  id: string;
  date: string;
  stationId: string;
  shift: string;
  customer: string;
  purpose: string;
  depositSlipRef: string;
  soaRef: string;
  paymentType: string;
  crArNo: string;
  amount: number;
  mayaPaymentRef: string;
  checkNo: string;
  checkDate: string;
  issuingBank: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeterReadingRecord {
  id: string;
  stationId: string;
  shift: string;
  readingDate: string;
  readingTime: string;
  nozzle: string;
  tankRef: string;
  product: string;
  reading: number;
  readingType: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type BankPickupStatus = 'In-transit' | 'Deposited';

export interface BankPickupRecord {
  id: string;
  stationId: string;
  pickUpDate: string;
  pickUpTime: string;
  bankRepresentative: string;
  depositSlipRef: string;
  depositType: string;
  slipAmount: number;
  countedAmount: number;
  status: BankPickupStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VdsRecord {
  id: string;
  stationId: string;
  date: string;
  depositSlipRef: string;
  vdsRefNo: string;
  depositDate: string;
  depositTime: string;
  depositType: string;
  amount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DsrFuelSaleRecord {
  id: string;
  stationId: string;
  station: string;
  date: string; // YYYY-MM-DD
  shift: string;
  product: string;
  totalQty: number;
  creditVolume: number;
  cashVolume: number;
  cashlessVolume: number;
  rate: number;
  creditDisc: number;
  cashDisc: number;
  cashlessDisc: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterLovConfig {
  id: string;
  stations: string[];
  shifts: string[];
  sources: string[];
  depositTypes: string[];
  purposes: string[];
  paymentTypes: string[];
  products: string[];
  readingTypes: string[];
  creditCustomers: string[];
  updatedAt: string;
}
