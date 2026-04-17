import React from 'react';

interface AppLoadingStateProps {
  title?: string;
  subtitle?: string;
}

export default function AppLoadingState({ title = "Loading...", subtitle = "Please wait while data is being loaded." }: AppLoadingStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-6">
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center max-w-md w-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
