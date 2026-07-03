"use client";

interface StatusBadgeProps {
  status: string;
  variant?: "green" | "orange" | "gray" | "blue";
}

const variantClasses: Record<string, string> = {
  green: "bg-malachite/10 text-malachite",
  orange: "bg-terre-cuite/10 text-terre-cuite",
  gray: "bg-gris/10 text-gris",
  blue: "bg-bleu/10 text-bleu",
};

export default function StatusBadge({ status, variant = "gray" }: StatusBadgeProps) {
  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${variantClasses[variant] || variantClasses.gray}`}>
      {status}
    </span>
  );
}
