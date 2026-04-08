interface LoadingSpinnerProps {
  className?: string;
}

export default function LoadingSpinner({ className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-malachite/30 border-t-malachite" />
      <p className="text-sm text-gris">Chargement...</p>
    </div>
  );
}
