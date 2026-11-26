import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, Mail, LogOut, MapPin, X } from 'lucide-react';
import { authService } from '../auth/authService';
import { firestoreService } from '../../services/firestoreService';
import { useDataCache } from '../../context/DataCacheContext';
import { formatStationOption } from '../../data/visaMasterData';

interface HeaderProps {
  onOpenMobileSidebar?: () => void;
  selectedStation: string;
  onSelectStation: (station: string) => void;
  stations: string[];
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  selectedStation,
  onSelectStation,
  stations,
}) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isCloud = firestoreService.isCloudEnabled();

  const { deposits, collections, bankPickups, vdsRecords, dsrFuelSales } = useDataCache();

  const stationOptions = useMemo(() => {
    const set = new Set<string>(stations);
    deposits.forEach((d) => d.stationId && set.add(d.stationId));
    collections.forEach((c) => c.stationId && set.add(c.stationId));
    bankPickups.forEach((b) => b.stationId && set.add(b.stationId));
    vdsRecords.forEach((v) => v.stationId && set.add(v.stationId));
    dsrFuelSales.forEach((f) => f.stationId && set.add(f.stationId));
    return Array.from(set).sort();
  }, [deposits, collections, bankPickups, vdsRecords, dsrFuelSales, stations]);

  useEffect(() => {
    return authService.subscribe((session) => {
      setCurrentUser(session?.user ?? null);
      setAvatarError(false);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const isFiltered = selectedStation !== 'All Stations';

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 select-none shadow-xs">
      {/* Left: Mobile menu + Global Station Filter */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-lg border transition-colors ${
              isFiltered
                ? 'bg-blue-50/70 border-blue-300 text-[#0E4DA4]'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <MapPin
              className={`h-3.5 w-3.5 shrink-0 ${
                isFiltered ? 'text-[#0E4DA4]' : 'text-slate-500'
              }`}
            />
            <span className="hidden md:inline text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Station:
            </span>
            <select
              aria-label="Filter by station"
              value={selectedStation}
              onChange={(e) => onSelectStation(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1 max-w-[200px] sm:max-w-[270px] truncate"
            >
              <option value="All Stations">
                All Stations ({stationOptions.length} Active)
              </option>
              {stationOptions.map((st) => (
                <option key={st} value={st}>
                  {formatStationOption(st)}
                </option>
              ))}
            </select>
            {isFiltered && (
              <button
                type="button"
                onClick={() => onSelectStation('All Stations')}
                title="Reset to All Stations"
                className="p-0.5 rounded hover:bg-blue-100 text-[#0E4DA4] cursor-pointer shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Sync Status + User Profile */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
            isCloud
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}
          title={
            isCloud
              ? 'Connected to Firebase Firestore'
              : 'Local offline mode'
          }
        >
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 ${
              isCloud ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span>{isCloud ? 'Firestore Live' : 'Local Mode'}</span>
        </div>

        {/* User profile */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setProfileDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors cursor-pointer"
          >
            {currentUser?.photoURL && !avatarError ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.fullName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="h-8 w-8 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#0E4DA4] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {getInitials(currentUser?.fullName)}
              </div>
            )}
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.fullName || 'Operator'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium capitalize leading-tight">
                {currentUser?.role?.replace('_', ' ') || 'station clerk'}
              </p>
            </div>
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 hidden sm:block ${
                profileDropdownOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white py-2 shadow-xl animate-in fade-in duration-150 z-50">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{currentUser?.fullName}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{currentUser?.email}</span>
                </p>
              </div>

              <div className="pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
