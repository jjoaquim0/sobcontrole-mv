import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '../../components/shared/PageHeader';
import { SettingsSidebar, SettingsTabId } from './SettingsSidebar';
import { GeneralTab } from './tabs/GeneralTab';
import { AppearanceTab } from './tabs/AppearanceTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { SecurityTab } from './tabs/SecurityTab';
import { IntegrationsTab } from './tabs/IntegrationsTab';
import { TeamTab } from './tabs/TeamTab';
import { SubscriptionTab } from './tabs/SubscriptionTab';
import { DataTab } from './tabs/DataTab';

const renderTab = (tab: SettingsTabId): React.ReactNode => {
  switch (tab) {
    case 'general':
      return <GeneralTab />;
    case 'appearance':
      return <AppearanceTab />;
    case 'notifications':
      return <NotificationsTab />;
    case 'security':
      return <SecurityTab />;
    case 'integrations':
      return <IntegrationsTab />;
    case 'team':
      return <TeamTab />;
    case 'subscription':
      return <SubscriptionTab />;
    case 'data':
      return <DataTab />;
    default:
      return null;
  }
};

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general');

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Gerencie as preferências da sua empresa" />

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-[220px] md:shrink-0">
          <SettingsSidebar active={activeTab} onSelect={setActiveTab} />
        </div>

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {renderTab(activeTab)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
