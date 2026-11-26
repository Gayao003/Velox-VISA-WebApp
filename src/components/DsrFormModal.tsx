import React, { useState, useEffect } from 'react';
import { Modal } from '../core/ui/modal';
import { Button } from '../core/ui/button';
import { Input } from '../core/ui/input';
import { DsrRecord, MasterLovConfig } from '../models/visa';
import { todayIso, generateRefNo } from '../lib/format';
import { authService } from '../core/auth/authService';
import { useToast } from '../core/ui/toast';

interface DsrFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: DsrRecord) => Promise<void>;
  initialRecord?: DsrRecord | null;
  defaultStation: string;
  lovs: MasterLovConfig;
}

export const DsrFormModal: React.FC<DsrFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRecord,
  defaultStation,
  lovs,
}) => {
  const currentUser = authService.getCurrentUser();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [dsrNo, setDsrNo] = useState('');
  const [stationId, setStationId] = useState('');
  const [stationName, setStationName] = useState('');
  const [date, setDate] = useState(todayIso());
  const [shift, setShift] = useState('1ST SHIFT');

  const [creditCustomerSales, setCreditCustomerSales] = useState(0);
  const [prepaymentSales, setPrepaymentSales] = useState(0);
  const [fleetCardCustomer, setFleetCardCustomer] = useState(0);
  const [fleetCardInterCompany, setFleetCardInterCompany] = useState(0);

  const [status, setStatus] = useState<'draft' | 'submitted'>('submitted');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (initialRecord) {
      setDsrNo(initialRecord.dsrNo);
      setStationId(initialRecord.stationId);
      setStationName(initialRecord.stationName);
      setDate(initialRecord.date);
      setShift(initialRecord.shift);
      setCreditCustomerSales(initialRecord.creditCustomerSales);
      setPrepaymentSales(initialRecord.prepaymentSales);
      setFleetCardCustomer(initialRecord.fleetCardCustomer);
      setFleetCardInterCompany(initialRecord.fleetCardInterCompany);
      setStatus(initialRecord.status);
      setNotes(initialRecord.notes || '');
    } else {
      const st =
        defaultStation && defaultStation !== 'All Stations'
          ? defaultStation
          : lovs.stations[0] || 'VLX-AG1';
      setDsrNo(generateRefNo('DSR'));
      setStationId(st);
      setStationName(st);
      setDate(todayIso());
      setShift(lovs.shifts[0] || '1ST SHIFT');
      setCreditCustomerSales(0);
      setPrepaymentSales(0);
      setFleetCardCustomer(0);
      setFleetCardInterCompany(0);
      setStatus('submitted');
      setNotes('');
    }
  }, [isOpen, initialRecord, defaultStation, lovs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const record: DsrRecord = {
        id: initialRecord?.id || `dsr_${Date.now()}`,
        dsrNo: dsrNo.trim() || generateRefNo('DSR'),
        stationId,
        stationName: stationName.trim() || stationId,
        date,
        shift,
        cashToBeAccounted: 0,
        cashOnHand: 0,
        variance: 0,
        overShort: 0,
        debit: 0,
        credit: 0,
        gcash: 0,
        paymaya: 0,
        creditCustomerSales: Number(creditCustomerSales) || 0,
        prepaymentSales: Number(prepaymentSales) || 0,
        fleetCardCustomer: Number(fleetCardCustomer) || 0,
        fleetCardInterCompany: Number(fleetCardInterCompany) || 0,
        denominations: [],
        denominationTotal: 0,
        status,
        notes: notes.trim(),
        createdBy: initialRecord?.createdBy || currentUser?.fullName || 'Operator',
        createdByEmail: initialRecord?.createdByEmail || currentUser?.email || '',
        createdAt: initialRecord?.createdAt || now,
        updatedAt: now,
      };
      await onSave(record);
      onClose();
    } catch (err: any) {
      toast(err?.message || 'Failed to save DSR', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const numInput = (label: string, value: number, onChange: (n: number) => void) => (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
      <Input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRecord ? `Edit DSR — ${initialRecord.dsrNo}` : 'New Daily Sales Report (DSR)'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header Information */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Header Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                DSR Reference No. <span className="text-red-500">*</span>
              </label>
              <Input value={dsrNo} onChange={(e) => setDsrNo(e.target.value)} required />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Station ID <span className="text-red-500">*</span>
              </label>
              <select
                value={stationId}
                onChange={(e) => {
                  setStationId(e.target.value);
                  if (!stationName || stationName === stationId) {
                    setStationName(e.target.value);
                  }
                }}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {lovs.stations.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Station Name
              </label>
              <Input
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="e.g. Velox Bulua Station"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Shift <span className="text-red-500">*</span>
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {lovs.shifts.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Credit Sales */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Credit Sales
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {numInput('Credit Customer Sales', creditCustomerSales, setCreditCustomerSales)}
            {numInput('Prepayment Sales', prepaymentSales, setPrepaymentSales)}
            {numInput('Fleet Card Sales - Customer', fleetCardCustomer, setFleetCardCustomer)}
            {numInput(
              'Fleet Card Sales - Inter-Company',
              fleetCardInterCompany,
              setFleetCardInterCompany
            )}
          </div>
        </div>

        {/* Status & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Report Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'submitted')}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
            >
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Remarks / Notes
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional shift notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            {initialRecord ? 'Update DSR' : 'Save DSR'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
