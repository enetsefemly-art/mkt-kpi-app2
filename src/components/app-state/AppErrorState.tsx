import React from 'react';

interface AppErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function AppErrorState({ title = "Something went wrong", message, onRetry }: AppErrorStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-6">
      <div className="bg-white p-8 rounded-xl border border-red-200 shadow-sm flex flex-col items-center text-center max-w-md w-full">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
        {message && <p className="text-sm text-gray-500 mb-6">{message}</p>}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
