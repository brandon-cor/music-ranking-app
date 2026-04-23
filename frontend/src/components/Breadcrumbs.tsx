// lightweight breadcrumb trail for navigating back through party screens
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-xs text-gray-500 ${className}`}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="rounded text-gray-400 transition hover:text-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current={isLast ? 'page' : undefined} className="text-gray-200">
                {item.label}
              </span>
            )}
            {!isLast && <span className="text-gray-700">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
