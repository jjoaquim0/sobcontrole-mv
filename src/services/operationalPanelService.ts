import { getContracts } from '@/services/contractsService';
import { getDemands } from '@/services/demandsService';
import { getObligationsOverview } from '@/services/obligationsService';
import { getPeopleDocsOverview } from '@/services/peopleDocsService';
import type { PanelSources } from '@/pages/operationalPanel/operationalPanelDomain';

/** Busca as fontes do painel operacional em paralelo, com as mesmas regras de cada módulo. */
export const getOperationalPanelSources = async (): Promise<PanelSources> => {
  const [contracts, demands, peopleDocs, obligations] = await Promise.all([
    getContracts(),
    getDemands(),
    getPeopleDocsOverview(),
    getObligationsOverview(),
  ]);
  return { contracts, demands, peopleDocs, obligations };
};
