import React from 'react';
import { Home, ChevronRight, ChevronLeft, ArrowUpDown, Search, Filter, PlusCircle } from 'lucide-react';
import { Button } from '../core/ui/button';
import { Input } from '../core/ui/input';
import { TableHead } from '../core/ui/table';

interface PageHeaderProps {
  breadcrumb: string;
  title: string;
  countLabel: string;
  subtitle: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  breadcrumb,
  title,
  countLabel,
  subtitle,
  actions,
}) => (
  <div className="flex flex-col gap-1.5 pb-4 border-b border-slate-200">
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
      <Home className="h-3.5 w-3.5 text-slate-400" />
      <ChevronRight className="h-3 w-3 text-slate-400" />
      <span className="font-medium">VISA</span>
      <ChevronRight className="h-3 w-3 text-slate-400" />
      <span className="font-bold text-slate-900">{breadcrumb}</span>
    </nav>

    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          {countLabel}
        </span>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>

    <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">{subtitle}</div>
  </div>
);

interface TableToolbarProps {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  filters?: React.ReactNode;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  pageSize,
  onPageSizeChange,
  filters,
}) => (
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 shadow-card">
    <div className="flex-1">
      <Input
        icon={<Search className="h-4 w-4" />}
        placeholder={searchPlaceholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>

    {filters}

    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Show:</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
      </select>
    </div>
  </div>
);

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalEntries: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  totalEntries,
  pageSize,
  onPageChange,
}) => {
  if (totalEntries === 0) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalEntries);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-card text-xs">
      <div className="text-slate-500 font-medium">
        Showing <span className="font-bold text-slate-900">{start}</span> to{' '}
        <span className="font-bold text-slate-900">{end}</span> of{' '}
        <span className="font-bold text-slate-900">{totalEntries}</span> entries
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Prev</span>
        </Button>

        <span className="px-3 py-1 rounded-md bg-slate-100 font-bold text-slate-700">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="p-12 text-center rounded-xl border border-dashed border-slate-300 bg-white space-y-3">
    <div className="inline-flex p-3 rounded-2xl bg-slate-100 text-slate-400">
      <Filter className="h-8 w-8" />
    </div>
    <h3 className="text-base font-bold text-slate-800">{title}</h3>
    <p className="text-xs text-slate-500 max-w-sm mx-auto">{description}</p>
    <div className="pt-2">
      <Button variant="primary" size="sm" onClick={onAction} className="font-bold">
        <PlusCircle className="h-4 w-4 mr-1.5" />
        <span>{actionLabel}</span>
      </Button>
    </div>
  </div>
);

export function SortableHead<T extends string>({
  field,
  activeField,
  onSort,
  children,
  className,
}: {
  field: T;
  activeField: T;
  onSort: (f: T) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead
      onClick={() => onSort(field)}
      className={`cursor-pointer hover:text-slate-900 select-none ${className || ''}`}
    >
      <div className="flex items-center gap-1.5">
        {children}
        <ArrowUpDown
          className={`h-3.5 w-3.5 ${activeField === field ? 'text-blue-600' : 'text-slate-400'}`}
        />
      </div>
    </TableHead>
  );
}
