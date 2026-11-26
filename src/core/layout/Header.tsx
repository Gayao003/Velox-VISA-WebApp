import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, ChevronDown, Mail, LogOut } from 'lucide-react';
import { authService } from '../auth/authService';
import { firestoreService } from '../../services/firestoreService';

interface HeaderProps {
  onOpenMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar }) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isCloud = firestoreService.isCloudEnabled();

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

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 select-none shadow-xs">
      {/* Left: Mobile menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right: Sync Status + User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
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
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
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
