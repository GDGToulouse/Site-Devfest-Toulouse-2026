"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 3000;

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const STYLES: Record<ToastType, { bg: string; icon: string }> = {
  success: {
    bg: "bg-malachite text-blanc",
    icon: "bg-blanc/20",
  },
  error: {
    bg: "bg-terre-cuite text-blanc",
    icon: "bg-blanc/20",
  },
  info: {
    bg: "bg-bleu text-blanc",
    icon: "bg-blanc/20",
  },
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: number) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setIsExiting(true);
    }, TOAST_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isExiting) return;
    const timeout = setTimeout(() => onClose(toast.id), 300);
    return () => clearTimeout(timeout);
  }, [isExiting, onClose, toast.id]);

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsExiting(true);
  };

  const style = STYLES[toast.type];

  return (
    <div
      role="alert"
      className={`
        flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg min-w-[300px] max-w-[420px] overflow-hidden
        ${style.bg}
        ${isExiting ? "animate-toast-exit" : "animate-toast-enter"}
      `}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${style.icon}`}
      >
        {ICONS[toast.type]}
      </span>

      <span className="flex-1 text-sm font-medium">{toast.message}</span>

      <button
        onClick={handleClose}
        className="shrink-0 rounded p-1 hover:bg-blanc/20 transition-colors"
        aria-label="Fermer"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-blanc/20">
        <div
          className="h-full bg-blanc/50"
          style={{
            animation: `toast-progress ${TOAST_DURATION}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>

      {/* Animations via inline style tag */}
      <style>{`
        @keyframes toast-enter {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes toast-exit {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-toast-enter {
          animation: toast-enter 0.3s ease-out forwards;
        }
        .animate-toast-exit {
          animation: toast-exit 0.3s ease-in forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
