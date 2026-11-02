/**
 * Editorial Top Navigation Bar & Mobile Sheet Drawer
 * Matches chord-prototype.html: ♯1 mark, clean typography links,
 * vivid #FF4B30 active dot indicators, and fullscreen sheet menu.
 */

import React, { useState, useEffect } from 'react';
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
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const toggleTheme = () => {
    const nextTheme: UserPreferences['theme'] =
      preferences.theme === 'light' ? 'dark' : preferences.theme === 'dark' ? 'system' : 'light';
    onUpdatePreferences({ ...preferences, theme: nextTheme });
  };

  const handleNav = (tab: NavTab) => {
    onSelectTab(tab);
    setMenuOpen(false);
  };

  const navItems: Array<{ id: NavTab; label: string; num: string }> = [
    { id: 'home', label: 'Home', num: '00' },
    { id: 'trainer', label: 'Train', num: '01' },
    { id: 'quiz', label: 'Quiz', num: '02' },
    { id: 'collections', label: 'Collections', num: '03' },
    { id: 'bookmarks', label: 'Bookmarks', num: '04' },
    { id: 'progress', label: 'Progress', num: '05' },
    { id: 'history', label: 'History', num: '06' },
    { id: 'backup', label: 'Backup', num: '07' },
  ];

  return (
    <>
      <header className="top" id="top">
        <div className="ngrp">
          <button
            type="button"
            className="mark"
            onClick={() => handleNav('home')}
            aria-label="chord home"
          >
            ♯1
          </button>
          <button
            type="button"
            className="nl micro"
            onClick={() => handleNav('trainer')}
            aria-current={activeTab === 'trainer' ? 'page' : undefined}
          >
            Train
          </button>
          <button
            type="button"
            className="nl micro"
            onClick={() => handleNav('quiz')}
            aria-current={activeTab === 'quiz' ? 'page' : undefined}
          >
            Quiz
          </button>
        </div>

        <div className="ngrp">
          <button
            type="button"
            className="nl micro"
            onClick={() => handleNav('collections')}
            aria-current={activeTab === 'collections' ? 'page' : undefined}
          >
            Collections
          </button>
          <button
            type="button"
            className="nl micro"
            onClick={() => handleNav('progress')}
            aria-current={activeTab === 'progress' ? 'page' : undefined}
          >
            Progress
          </button>
          <button
            type="button"
            className="nl micro"
            onClick={() => handleNav('bookmarks')}
            aria-current={activeTab === 'bookmarks' ? 'page' : undefined}
          >
            Bookmarks
          </button>
          <button
            type="button"
            className="nl micro"
            onClick={() => handleNav('history')}
            aria-current={activeTab === 'history' ? 'page' : undefined}
          >
            History
          </button>
          <button
            type="button"
            className="nl micro"
            onClick={() => handleNav('backup')}
            aria-current={activeTab === 'backup' ? 'page' : undefined}
          >
            Backup
          </button>

          {/* Theme button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="nl micro hide-m"
            title={`Current theme: ${preferences.theme}. Click to switch.`}
            aria-label={`Current theme: ${preferences.theme}. Click to switch.`}
          >
            {preferences.theme === 'dark' ? 'Light' : 'Dark'}
          </button>

          {/* PWA Install Button */}
          <div className="hide-m">
            <PWAInstallButton />
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            className="menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <i></i>
          </button>
        </div>
      </header>

      {/* Fullscreen Mobile Navigation Sheet Drawer */}
      {menuOpen && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="row-top">
            <span className="mark">♯1</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={toggleTheme}
                className="micro"
                style={{ minHeight: '44px', padding: '0 8px' }}
              >
                {preferences.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button
                type="button"
                className="micro"
                onClick={() => setMenuOpen(false)}
                style={{ minHeight: '44px', padding: '0 8px' }}
                autoFocus
              >
                Close ✕
              </button>
            </div>
          </div>
          <nav>
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
              >
                <span>{item.label.toLowerCase()}.</span>
                <span className="micro">{item.num}</span>
              </button>
            ))}
          </nav>
          <div className="mt-auto flex items-center justify-between pt-6 border-t border-[var(--line)]">
            <span className="micro muted">Chord training · offline-first</span>
            <PWAInstallButton />
          </div>
        </div>
      )}
    </>
  );
};
