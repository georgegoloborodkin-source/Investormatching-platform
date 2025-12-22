import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'inactive' | 'completed' | 'not-attending' | 'upcoming' | 'cancelled';
  className?: string;
}

const statusConfig = {
  active: {
    label: 'Active',
    className: 'status-active'
  },
  pending: {
    label: 'Pending',
    className: 'status-pending'
  },
  inactive: {
    label: 'Inactive',
    className: 'status-inactive'
  },
  completed: {
    label: 'Completed',
    className: 'status-completed'
  },
  upcoming: {
    label: 'Upcoming',
    className: 'status-pending'
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-destructive text-destructive-foreground'
  },
  'not-attending': {
    label: 'Not Attending',
    className: 'bg-destructive text-destructive-foreground'
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}