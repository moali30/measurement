"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<(value: boolean) => void>(() => () => {});

  const confirm = (opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  };

  const handleConfirm = () => {
    resolver(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    resolver(false);
    setIsOpen(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
            onClick={handleCancel}
          />
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden z-10 transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="text-red-600 w-6 h-6" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
                {options.title || "تأكيد الإجراء"}
              </h3>
              <p className="text-center text-gray-500 mb-6">
                {options.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl transition-colors"
                >
                  {options.cancelText || "إلغاء"}
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-red-200"
                >
                  {options.confirmText || "تأكيد"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
