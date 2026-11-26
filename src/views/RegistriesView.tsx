import React, { useState } from 'react';
import { Landmark, Wallet, Gauge, Home, ChevronRight } from 'lucide-react';
import { ShiftDepositsView } from './ShiftDepositsView';
import { ShiftCollectionsView } from './ShiftCollectionsView';
import { MeterReadingsView } from './MeterReadingsView';

type RegistryTab = 'deposits' | 'collections' | 'meters';

export const RegistriesView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RegistryTab>('deposits');

  const tabs: { id: RegistryTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'deposits',
      label: 'Shift Deposit Registry',
      icon: <Landmark className="h-4 w-4" />,
    },
    {
      id: 'collections',
      label: 'Shift Collection Registry',
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      id: 'meters',
      label: 'Meter Reading',
      icon: <Gauge className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb + Tab Bar */}
      <div className="flex flex-col gap-3 pb-3 border-b border-slate-200">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Home className="h-3.5 w-3.5 text-slate-400" />
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-medium">TRACE</span>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-bold text-slate-900">Station Registries</span>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'deposits' && <ShiftDepositsView />}
      {activeTab === 'collections' && <ShiftCollectionsView />}
      {activeTab === 'meters' && <MeterReadingsView />}
    </div>
  );
};
