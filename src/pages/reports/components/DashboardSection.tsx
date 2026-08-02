import React from 'react';

interface DashboardSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  description,
  icon,
  action,
  children,
  className = '',
}) => {
  const sectionId = `report-section-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <section className={`space-y-4 ${className}`} aria-labelledby={sectionId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          {icon && <div className="mt-0.5 rounded-xl bg-[#00a8d8]/10 p-2 text-[#0089b0] dark:text-[#53dcff]">{icon}</div>}
          <div>
            <h2 id={sectionId} className="text-base font-bold text-gray-950 dark:text-white">{title}</h2>
            {description && <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
};
