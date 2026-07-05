import React from 'react';
import { FileText, Image, Table, FileCode, File, LucideIcon } from 'lucide-react';

interface CategoryIconConfig {
  Icon: LucideIcon;
  classes: string;
}

export const getFileIconConfig = (mimeType: string): CategoryIconConfig => {
  if (mimeType === 'application/pdf') {
    return { Icon: FileText, classes: 'text-red-500 bg-red-50 dark:bg-red-950/20' };
  }
  if (mimeType.startsWith('image/')) {
    return { Icon: Image, classes: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20' };
  }
  if (
    mimeType === 'text/csv' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return { Icon: Table, classes: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' };
  }
  if (mimeType === 'text/xml' || mimeType === 'application/xml') {
    return { Icon: FileCode, classes: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20' };
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { Icon: FileText, classes: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20' };
  }
  return { Icon: File, classes: 'text-gray-500 bg-gray-50 dark:bg-gray-800/40' };
};

interface CategoryIconProps {
  mimeType: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { wrapper: 'w-9 h-9', icon: 'w-4.5 h-4.5' },
  md: { wrapper: 'w-12 h-12', icon: 'w-6 h-6' },
  lg: { wrapper: 'w-16 h-16', icon: 'w-8 h-8' },
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({ mimeType, size = 'md' }) => {
  const { Icon, classes } = getFileIconConfig(mimeType);
  const dims = sizeMap[size];

  return (
    <div className={`${dims.wrapper} rounded-xl flex items-center justify-center shrink-0 ${classes}`}>
      <Icon className={dims.icon} />
    </div>
  );
};
