import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  Truck,
  Receipt,
  ChevronRight,
  Maximize2,
  Minimize2,
  MousePointer2,
  LogOut,
  Fuel,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { authService } from '../auth/authService';

type SidebarMode = 'expanded' | 'collapsed' | 'hover';

interface SidebarProps {
  onCloseMobile?: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile, onCollapsedChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<SidebarMode>('expanded');
  const [isHovered, setIsHovered] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const isExpanded = mode === 'expanded' || (mode === 'hover' && isHovered);
  const isCollapsed = !isExpanded;

  useEffect(() => {
    onCollapsedChange?.(isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideBtn = toggleBtnRef.current?.contains(target);
      const insideMenu = modeMenuRef.current?.contains(target);
      if (!insideBtn && !insideMenu) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openModeMenu = () => {
    if (!toggleBtnRef.current) return;
    const rect = toggleBtnRef.current.getBoundingClientRect();
    const menuHeight = 178;
    const menuWidth = 208;
    const vw = window.innerWidth;
    const top = Math.max(8, rect.top - menuHeight - 6);
    const left = Math.min(rect.left, vw - menuWidth - 12);
    setMenuPos({ top, left });
    setModeMenuOpen((p) => !p);
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const navItems = [
    {
      title: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
    },
    {
      title: 'Shift Deposit Registry',
      path: '/shift-deposits',
      icon: <Landmark className="h-4 w-4 shrink-0" />,
    },
    {
      title: 'Shift Collection Registry',
      path: '/shift-collections',
      icon: <Wallet className="h-4 w-4 shrink-0" />,
    },
    {
      title: 'Bank Pickup Registry',
      path: '/bank-pickups',
      icon: <Truck className="h-4 w-4 shrink-0" />,
    },
    {
      title: 'VDS Registry',
      path: '/vds-registry',
      icon: <Receipt className="h-4 w-4 shrink-0" />,
    },
  ];

  const modeOptions: { key: SidebarMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'expanded', label: 'Expand', icon: <Maximize2 className="h-3.5 w-3.5" />, desc: 'Always show labels' },
    { key: 'collapsed', label: 'Collapse', icon: <Minimize2 className="h-3.5 w-3.5" />, desc: 'Icons only' },
    { key: 'hover', label: 'Hover to Expand', icon: <MousePointer2 className="h-3.5 w-3.5" />, desc: 'Collapsed by default, expand on hover' },
  ];

  return (
    <aside
      className={cn(
        'relative shrink-0 flex flex-col h-screen border-r border-slate-200 bg-white select-none overflow-hidden transition-all duration-300',
        isExpanded ? 'w-64' : 'w-16'
      )}
      onMouseEnter={() => mode === 'hover' && setIsHovered(true)}
      onMouseLeave={() => {
        if (mode === 'hover') setIsHovered(false);
        setModeMenuOpen(false);
      }}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-center px-4 border-b border-slate-200 overflow-hidden shrink-0">
        {!logoError ? (
          <img
            src="/visa-logo.png"
            alt="VISA"
            onError={() => setLogoError(true)}
            className={cn(
              'w-auto object-contain transition-all duration-200',
              isExpanded ? 'h-9 max-w-[155px]' : 'h-7 max-w-[42px]'
            )}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#991B1B] to-[#C8102E] text-white flex items-center justify-center shadow-sm shrink-0">
              <Fuel className="h-4.5 w-4.5" />
            </div>
            {isExpanded && (
              <div className="leading-tight">
                <div className="text-sm font-extrabold tracking-tight text-slate-900">VELOX VISA</div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Station App</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-6">
        <div>
          <div
            className={cn(
              'px-2 mb-2 transition-all duration-150 overflow-hidden',
              isExpanded ? 'opacity-100 max-h-6' : 'opacity-0 max-h-0'
            )}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
              Station Operations
            </span>
          </div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === '/dashboard' && location.pathname === '/');
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onCloseMobile}
                  title={isCollapsed ? item.title : undefined}
                  className={cn(
                    'flex items-center justify-between px-2.5 py-2.5 rounded-lg text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-red-50 text-[#991B1B]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
                    isCollapsed && 'justify-center'
                  )}
                >
                  <div className={cn('flex items-center gap-2.5', isCollapsed && 'justify-center')}>
                    <span className={cn(isActive ? 'text-[#C8102E]' : 'text-slate-500')}>
                      {item.icon}
                    </span>
                    <span
                      className={cn(
                        'transition-all duration-200 whitespace-nowrap overflow-hidden',
                        isExpanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'
                      )}
                    >
                      {item.title}
                    </span>
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Logout + Mode Toggle */}
      <div className="shrink-0 border-t border-slate-200 px-2 py-3 space-y-1">
        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Sign Out' : undefined}
          className={cn(
            'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span
            className={cn(
              'transition-all duration-200 whitespace-nowrap overflow-hidden',
              isExpanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'
            )}
          >
            Sign Out
          </span>
        </button>

        {/* Mode toggle — fixed portal dropdown */}
        <div className={cn('relative flex', isExpanded ? 'justify-end' : 'justify-center')}>
          <button
            ref={toggleBtnRef}
            onClick={openModeMenu}
            title="Sidebar display mode"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
          >
            {mode === 'expanded' && <Maximize2 className="h-3.5 w-3.5" />}
            {mode === 'collapsed' && <Minimize2 className="h-3.5 w-3.5" />}
            {mode === 'hover' && <MousePointer2 className="h-3.5 w-3.5" />}
            {isExpanded && <ChevronRight className="h-3 w-3" />}
          </button>

          {modeMenuOpen &&
            menuPos &&
            createPortal(
              <div
                ref={modeMenuRef}
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  left: menuPos.left,
                  zIndex: 9999,
                  minWidth: '13rem',
                }}
                className="w-52 rounded-xl border border-slate-200 bg-white shadow-2xl py-1 animate-in fade-in duration-150"
              >
                <div className="px-3 pt-1.5 pb-1 border-b border-slate-100 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Sidebar Mode
                  </span>
                </div>
                {modeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setMode(opt.key);
                      setModeMenuOpen(false);
                      setIsHovered(false);
                    }}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors cursor-pointer',
                      mode === opt.key ? 'bg-blue-50/60' : ''
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 shrink-0',
                        mode === opt.key ? 'text-blue-600' : 'text-slate-400'
                      )}
                    >
                      {opt.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          'text-xs font-bold',
                          mode === opt.key ? 'text-blue-700' : 'text-slate-800'
                        )}
                      >
                        {opt.label}
                        {mode === opt.key && (
                          <span className="ml-1.5 text-[10px] text-blue-500">✓ Active</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>,
              document.body
            )}
        </div>
      </div>
    </aside>
  );
};
