"use client";

import React, { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
}

export function Tabs({ tabs }: TabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div className="w-full">
      <div className="flex space-x-1 border-b border-gray-200 mb-5 overflow-x-auto no-scrollbar scroll-smooth">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all duration-200 ease-in-out whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-blue-50/60 rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{ display: activeTab === tab.id ? 'block' : 'none' }}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
