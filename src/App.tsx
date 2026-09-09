import { StoreProvider, NavProvider, useNav } from './store';
import { Shell } from './components/Shell';
import { Cockpit } from './pages/Cockpit';
import { Launchpad } from './pages/Launchpad';
import { GatePage } from './pages/GatePage';
import { Gate6Page } from './pages/Gate6Page';
import { Gate7Page } from './pages/Gate7Page';
import { Gate8Page } from './pages/Gate8Page';
import { Gate9Page } from './pages/Gate9Page';
import { Gate10APage } from './pages/Gate10APage';
import { Gate10BPage } from './pages/Gate10BPage';
import { Gate10CPage } from './pages/Gate10CPage';
import { Gate10DPage } from './pages/Gate10DPage';
import { EnterpriseStructure } from './pages/EnterpriseStructure';
import { MasterData } from './pages/MasterData';
import { Procurement } from './pages/Procurement';
import { InventoryPage } from './pages/InventoryPage';
import { PlantPage } from './pages/PlantPage';
import { QualityPage } from './pages/QualityPage';
import { Simulator } from './pages/Simulator';
import { Configuration } from './pages/Configuration';
import { AuditPage } from './pages/AuditPage';

function Router() {
  const { page } = useNav();
  switch (page) {
    case 'cockpit': return <Cockpit />;
    case 'launchpad': return <Launchpad />;
    case 'gate': return <GatePage />;
    case 'gate6': return <Gate6Page />;
    case 'gate7': return <Gate7Page />;
    case 'gate8': return <Gate8Page />;
    case 'gate9': return <Gate9Page />;
    case 'gate10a': return <Gate10APage />;
    case 'gate10b': return <Gate10BPage />;
    case 'gate10c': return <Gate10CPage />;
    case 'gate10d': return <Gate10DPage />;
    case 'structure': return <EnterpriseStructure />;
    case 'masters': return <MasterData />;
    case 'procurement': return <Procurement />;
    case 'inventory': return <InventoryPage />;
    case 'plant': return <PlantPage />;
    case 'quality': return <QualityPage />;
    case 'simulator': return <Simulator />;
    case 'config': return <Configuration />;
    case 'audit': return <AuditPage />;
    default: return <Cockpit />;
  }
}

export default function App() {
  return (
    <StoreProvider>
      <NavProvider>
        <Shell>
          <Router />
        </Shell>
      </NavProvider>
    </StoreProvider>
  );
}
