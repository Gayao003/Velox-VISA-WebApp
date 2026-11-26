import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Database, Plus, Trash2, RotateCcw, Search } from 'lucide-react';
import { VisaOutletContext } from '../core/layout/AppLayout';
import { MasterLovConfig } from '../models/visa';
import { lovService, getDefaultLovConfig } from '../services/lovService';
import { Button } from '../core/ui/button';
import { Input } from '../core/ui/input';
import { ConfirmationModal } from '../core/modals/ConfirmationModal';
import { useToast } from '../core/ui/toast';
import { PageHeader } from '../components/PageShell';

type LovKey = keyof Omit<MasterLovConfig, 'id' | 'updatedAt'>;

const CATEGORIES: { key: LovKey; label: string }[] = [
  { key: 'stations', label: 'Station IDs' },
  { key: 'creditCustomers', label: 'Credit Customers' },
  { key: 'shifts', label: 'Shift Codes' },
  { key: 'sources', label: 'Deposit Sources' },
  { key: 'depositTypes', label: 'Deposit Types' },
  { key: 'purposes', label: 'Collection Purposes' },
  { key: 'paymentTypes', label: 'Payment Types' },
  { key: 'products', label: 'Fuel Products' },
  { key: 'readingTypes', label: 'Reading Types' },
];

export const MasterDataView: React.FC = () => {
  const { lovs } = useOutletContext<VisaOutletContext>();
  const { toast } = useToast();

  const [activeKey, setActiveKey] = useState<LovKey>('stations');
  const [search, setSearch] = useState('');
  const [newItem, setNewItem] = useState('');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isResetOpen, setIsResetOpen] = useState(false);

  const items = lovs[activeKey] || [];
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((it) => it.toLowerCase().includes(q));
  }, [items, search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newItem.trim();
    if (!val) return;
    if (items.some((x) => x.toLowerCase() === val.toLowerCase())) {
      toast('Item already exists in this list', 'warning');
      return;
    }
    const updated: MasterLovConfig = {
      ...lovs,
      [activeKey]: [val, ...items],
    };
    await lovService.save(updated);
    setNewItem('');
    toast(`Added "${val}" to ${activeKey}`, 'success');
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const updated: MasterLovConfig = {
      ...lovs,
      [activeKey]: items.filter((x) => x !== itemToDelete),
    };
    await lovService.save(updated);
    toast(`Removed "${itemToDelete}"`, 'info');
    setItemToDelete(null);
  };

  const confirmResetDefaults = async () => {
    await lovService.save(getDefaultLovConfig());
    setIsResetOpen(false);
    toast('Master Data LoVs restored from Excel defaults', 'success');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Master Data (LoVs)"
        title="Master Data & Lists of Values"
        countLabel={`${items.length} Entries`}
        subtitle={
          <>
            <Database className="h-3 w-3 text-blue-600" />
            <span>Manage Station IDs, Credit Customers, and Dropdown LoVs synced to Firestore</span>
          </>
        }
        actions={
          <Button variant="outline" size="md" onClick={() => setIsResetOpen(true)}>
            <RotateCcw className="h-4 w-4 text-slate-600" />
            <span>Restore Excel Defaults</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Category Selector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-2 space-y-1 h-fit">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveKey(cat.key);
                setSearch('');
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeKey === cat.key
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  activeKey === cat.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {(lovs[cat.key] || []).length}
              </span>
            </button>
          ))}
        </div>

        {/* Active List Panel */}
        <div className="lg:col-span-3 space-y-4">
          <form
            onSubmit={handleAdd}
            className="p-3 rounded-xl bg-white border border-slate-200 shadow-card flex flex-col sm:flex-row gap-2.5"
          >
            <div className="flex-1">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder={`Add new ${CATEGORIES.find((c) => c.key === activeKey)?.label}...`}
              />
            </div>
            <Button type="submit" variant="primary" size="md" className="font-bold shrink-0">
              <Plus className="h-4 w-4" />
              <span>Add Entry</span>
            </Button>
          </form>

          <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
            <div className="p-3 border-b border-slate-100">
              <Input
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter entries..."
              />
            </div>

            <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No matching entries.</div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item}
                    className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 text-xs"
                  >
                    <span className="font-semibold text-slate-800">{item}</span>
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Remove Master Data Entry"
        description={`Remove "${itemToDelete}" from ${activeKey}?`}
        confirmText="Remove"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        onConfirm={confirmResetDefaults}
        title="Restore Excel Defaults"
        description="This will restore all 60 stations, 436 credit customers, and default LoVs from the original Excel templates."
        confirmText="Restore Defaults"
        variant="warning"
      />
    </div>
  );
};
