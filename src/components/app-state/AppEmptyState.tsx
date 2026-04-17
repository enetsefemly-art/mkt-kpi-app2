import React from 'react';

interface AppEmptyStateProps {
  title?: string;
  message?: string;
}

export default function AppEmptyState({ title = "No data", message = "There is nothing to show yet." }: AppEmptyStateProps) {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center max-w-md w-full">
        <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}
