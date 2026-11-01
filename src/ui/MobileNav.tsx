/**
 * Responsive Mobile Bottom Navigation Bar
 */

import React from 'react';
import { BookOpen, Music, HelpCircle, BarChart3, Menu } from 'lucide-react';
import { NavTab } from './Header';

interface MobileNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMoreMenu: () => void;
  dueCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMoreMenu,
  dueCount = 0,
}) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#F8F6F1]/95 dark:bg-[#181614]/95 backdrop-blur-md border-t border-[#29251F]/10 dark:border-[#EDE8E1]/10 px-2 py-1.5 flex items-center justify-around"
      aria-label="Mobile Navigation"
    >
      <button
        type="button"
        onClick={() => onSelectTab('home')}
        className={`flex flex-col items-center gap-1 p-1.5 text-[10px] font-semibold transition-colors ${
          activeTab === 'home'
            ? 'text-[#A68A55] dark:text-[#CBB07E]'
            : 'text-[#29251F]/60 dark:text-[#EDE8E1]/60'
        }`}
      >
        <BookOpen className="w-4 h-4" />
        <span>Journal</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('trainer')}
        className={`flex flex-col items-center gap-1 p-1.5 text-[10px] font-semibold transition-colors ${
          activeTab === 'trainer'
            ? 'text-[#A68A55] dark:text-[#CBB07E]'
            : 'text-[#29251F]/60 dark:text-[#EDE8E1]/60'
        }`}
      >
        <Music className="w-4 h-4" />
        <span>Trainer</span>
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('quiz')}
        className={`flex flex-col items-center gap-1 p-1.5 text-[10px] font-semibold transition-colors relative ${
          activeTab === 'quiz'
            ? 'text-[#A68A55] dark:text-[#CBB07E]'
            : 'text-[#29251F]/60 dark:text-[#EDE8E1]/60'
        }`}
      >
        <HelpCircle className="w-4 h-4" />
        <span>Quiz</span>
        {dueCount > 0 && (
          <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-[#B85D19] dark:bg-[#D47732]" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onSelectTab('progress')}
        className={`flex flex-col items-center gap-1 p-1.5 text-[10px] font-semibold transition-colors ${
          activeTab === 'progress'
            ? 'text-[#A68A55] dark:text-[#CBB07E]'
            : 'text-[#29251F]/60 dark:text-[#EDE8E1]/60'
        }`}
      >
        <BarChart3 className="w-4 h-4" />
        <span>Mastery</span>
      </button>

      <button
        type="button"
        onClick={onOpenMoreMenu}
        className="flex flex-col items-center gap-1 p-1.5 text-[10px] font-semibold text-[#29251F]/60 dark:text-[#EDE8E1]/60 hover:text-[#29251F] dark:hover:text-[#EDE8E1]"
      >
        <Menu className="w-4 h-4" />
        <span>More</span>
      </button>
    </nav>
  );
};
