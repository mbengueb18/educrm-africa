import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: number; // percentage
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-brand-600",
  iconBg = "bg-brand-50",
}: StatCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1.5 mt-2">
              {isPositive && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                  <TrendingUp size={13} />+{change}%
                </span>
              )}
              {isNegative && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500">
                  <TrendingDown size={13} />{change}%
                </span>
              )}
              {!isPositive && !isNegative && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-gray-400">
                  <Minus size={13} />0%
                </span>
              )}
              {changeLabel && (
                <span className="text-xs text-gray-400">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110",
            iconBg
          )}
        >
          <Icon size={22} className={iconColor} />
        </div>
      </div>
    </div>
  );
}
