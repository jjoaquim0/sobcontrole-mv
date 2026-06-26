import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  action,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-themeText-secondaryLight dark:text-themeText-secondaryDark mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 self-start md:self-auto">{action}</div>}
    </div>
  );
};
