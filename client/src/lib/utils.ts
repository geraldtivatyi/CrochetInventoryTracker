import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400 * 2) {
    return 'Yesterday';
  } else if (diffInSeconds < 86400 * 7) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return formatDate(d);
  }
}

export function categoryColor(category?: string): string {
  switch (category?.toLowerCase()) {
    case 'accessory':
      return 'bg-primary-100 text-primary-800';
    case 'home':
      return 'bg-accent-100 text-accent-800';
    case 'toy':
      return 'bg-green-100 text-green-800';
    case 'clothing':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-neutral-100 text-neutral-800';
  }
}

export function stockStatusColor(quantity: number): string {
  if (quantity <= 2) {
    return 'bg-red-100 text-red-800';
  } else if (quantity <= 5) {
    return 'bg-amber-100 text-amber-800';
  } else {
    return 'bg-green-100 text-green-800';
  }
}

export function activityTypeIcon(type: string): { icon: string; bgColor: string; iconColor: string } {
  switch (type) {
    case 'add_yarn':
    case 'add_project':
      return { 
        icon: 'ri-add-line',
        bgColor: 'bg-primary-100',
        iconColor: 'text-primary-500'
      };
    case 'update_yarn':
    case 'update_project':
      return { 
        icon: 'ri-edit-line',
        bgColor: 'bg-accent-100',
        iconColor: 'text-accent-500'
      };
    case 'delete_yarn':
    case 'delete_project':
      return { 
        icon: 'ri-delete-bin-line',
        bgColor: 'bg-red-100',
        iconColor: 'text-red-500'
      };
    case 'calculate_price':
      return { 
        icon: 'ri-check-line',
        bgColor: 'bg-green-100',
        iconColor: 'text-green-500'
      };
    default:
      return { 
        icon: 'ri-information-line',
        bgColor: 'bg-neutral-100',
        iconColor: 'text-neutral-500'
      };
  }
}
