"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

export function Toast({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  }, [onRemove, toast.id]);

  useEffect(() => {
    // Show animation
    setIsVisible(true);

    // Auto-remove timer
    const timer = setTimeout(() => {
      handleRemove();
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.duration, handleRemove]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 cyber-green" />;
      case 'error':
        return <XCircle className="w-5 h-5 cyber-pink" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 cyber-yellow" />;
      case 'info':
        return <Info className="w-5 h-5 cyber-cyan" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-cyber-green';
      case 'error':
        return 'border-cyber-pink';
      case 'warning':
        return 'border-cyber-yellow';
      case 'info':
        return 'border-cyber-cyan';
    }
  };

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'cyber-green';
      case 'error':
        return 'cyber-pink';
      case 'warning':
        return 'cyber-yellow';
      case 'info':
        return 'cyber-cyan';
    }
  };

  return (
    <div
      className={`
        max-w-sm w-full bg-cyber-dark border-2 ${getBorderColor()} 
        shadow-lg rounded-none cyber-font
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isExiting ? 'scale-95' : 'scale-100'}
      `}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={`text-sm font-bold ${getTextColor()}`}>
              {toast.title}
            </p>
            {toast.message && (
              <p className="mt-1 text-xs cyber-cyan">
                {toast.message}
              </p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="cyber-hover inline-flex cyber-cyan opacity-75 hover:opacity-100"
              onClick={handleRemove}
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Toast container component
interface ToastContainerProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (toast: Omit<ToastData, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  };
}