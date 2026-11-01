/**
 * Minimal Editorial Header with Brand Mark, Navigation Links,
 * PWA Install Button, and Theme Switcher.
 */

import React from 'react';
import {
  Music,
  BookOpen,
  HelpCircle,
  FolderHeart,
  Bookmark,
  BarChart3,
  History,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { UserPreferences } from '../storage/indexedDb';

export type NavTab =
  | 'home'
  | 'trainer'
  | 'quiz'
  | 'collections'
  | 'bookmarks'
  | 'progress'
  | 'history'
  | 'backup';

interface HeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  isSessionActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  preferences,
  onUpdatePreferences,
  isSessionActive = false,
}) => {
  const toggleTheme = () => {
    const nextTheme: UserPreferences['theme'] =
      preferences.theme === 'light' ? 'dark' : preferences.theme === 'dark' ? 'system' : 'light';
    onUpdatePreferences({ ...preferences, theme: nextTheme });
  };

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'home', label: 'Journal', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'trainer', label: 'Instrument Trainer', icon: <Music className="w-4 h-4" /> },
    { id: 'quiz', label: 'Chord Quiz', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'collections', label: 'Collections', icon: <FolderHeart className="w-4 h-4" /> },
    { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'progress', label: 'Mastery', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#F8F6F1]/90 dark:bg-[#181614]/90 backdrop-blur-md border-b border-[#29251F]/10 dark:border-[#EDE8E1]/10 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-2.5 text-left group focus-visible:outline-hidden"
        >
          <div className="w-8 h-8 rounded-md bg-[#29251F] dark:bg-[#EDE8E1] text-[#F8F6F1] dark:text-[#181614] flex items-center justify-center font-editorial font-bold text-lg border border-[#A68A55]/40 shadow-xs">
            I
          </div>
          <div>
            <span className="font-editorial font-bold text-base tracking-tight text-[#29251F] dark:text-[#EDE8E1] block leading-none">
              Diatonic Chord Practice
            </span>
            <span className="text-[10px] tracking-widest uppercase font-semibold text-[#A68A55] dark:text-[#CBB07E]">
              Minimal Editorial Edition
            </span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[#EAE5DC]/50 dark:bg-[#221F1C]/60 p-1 rounded-lg border border-[#29251F]/10 dark:border-[#EDE8E1]/10" aria-label="Main Navigation">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#F8F6F1] dark:bg-[#181614] text-[#29251F] dark:text-[#EDE8E1] shadow-2xs border border-[#29251F]/10 dark:border-[#EDE8E1]/10'
                    : 'text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:text-[#29251F] dark:hover:text-[#EDE8E1] hover:bg-[#F8F6F1]/50 dark:hover:bg-[#181614]/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Tools: PWA Install, Theme Toggle, Backup */}
        <div className="flex items-center gap-2">
          <PWAInstallButton />

          <button
            type="button"
            onClick={() => onSelectTab('backup')}
            className={`hidden sm:inline-flex items-center text-xs font-semibold px-2.5 py-1.5 rounded-md border transition-colors ${
              activeTab === 'backup'
                ? 'bg-[#A68A55] text-white border-[#A68A55]'
                : 'border-[#29251F]/15 dark:border-[#EDE8E1]/15 text-[#29251F]/80 dark:text-[#EDE8E1]/80 hover:bg-[#EAE5DC]/50 dark:hover:bg-[#221F1C]'
            }`}
            title="Backup & Restore user data"
          >
            Backup
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-[#29251F]/70 dark:text-[#EDE8E1]/70 hover:bg-[#EAE5DC] dark:hover:bg-[#221F1C] border border-[#29251F]/10 dark:border-[#EDE8E1]/10 transition-colors"
            title={`Current theme: ${preferences.theme}. Click to toggle.`}
            aria-label="Toggle visual theme"
          >
            {preferences.theme === 'light' ? (
              <Sun className="w-4 h-4 text-[#A68A55]" />
            ) : preferences.theme === 'dark' ? (
              <Moon className="w-4 h-4 text-[#CBB07E]" />
            ) : (
              <Laptop className="w-4 h-4 text-[#29251F]/80 dark:text-[#EDE8E1]/80" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
