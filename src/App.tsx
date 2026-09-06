import { StoreProvider, NavProvider, useNav } from './store';
import { Shell } from './components/Shell';
import { Cockpit } from './pages/Cockpit';
import { EnterpriseStructure } from './pages/EnterpriseStructure';
import { MasterData } from './pages/MasterData';
import { Procurement } from './pages/Procurement';
import { InventoryPage } from './pages/InventoryPage';
import { Simulator } from './pages/Simulator';
import { Configuration } from './pages/Configuration';
import { AuditPage } from './pages/AuditPage';

function Router() {
  const { page } = useNav();
  switch (page) {
    case 'cockpit': return <Cockpit />;
    case 'structure': return <EnterpriseStructure />;
    case 'masters': return <MasterData />;
    case 'procurement': return <Procurement />;
    case 'inventory': return <InventoryPage />;
    case 'simulator': return <Simulator />;
    case 'config': return <Configuration />;
    case 'audit': return <AuditPage />;
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
