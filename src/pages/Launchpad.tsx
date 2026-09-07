import { useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Settings, Plus } from 'lucide-react';
import { useStore } from '../store';
import { Tile } from '../components/Tile';
import { refreshAllTiles } from '../engine/launchpad';

export function Launchpad() {
  const { state, run } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const userConfig = state.launchpadConfigs.find((c) => c.role === state.userId);
  
  if (!userConfig) {
    return (
      <div className="fade-up">
        <div className="card p-8 text-center">
          <div className="font-disp font-black text-[24px] mb-2">No Launchpad Configured</div>
          <div className="text-mute">Configure tiles for your role to see your personalized dashboard.</div>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    setRefreshing(true);
    run((s) => refreshAllTiles(s, s.userId));
    setTimeout(() => setRefreshing(false), 500);
  };

  // Group tiles by group
  const groups = Array.from(new Set(userConfig.tiles.map((t) => t.group)));

  return (
    <div className="fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-disp font-black text-[32px] leading-[1.05] tracking-tight">
            Launchpad
          </h1>
          <p className="text-mute mt-2">
            Your personalized dashboard with actionable work items and key metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn">
            <Settings size={14} />
            Personalize
          </button>
        </div>
      </div>

      {/* Tile Groups */}
      {groups.map((group) => {
        const groupTiles = userConfig.tiles.filter((t) => t.group === group);
        
        return (
          <div key={group} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-6 bg-acc rounded-full" />
              <h2 className="font-disp font-bold text-[18px] tracking-tight">
                {group.replace('_', ' ')}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {groupTiles.map((tile) => {
                const tileValue = state.tileValues[tile.id];
                
                if (!tileValue) {
                  return (
                    <div key={tile.id} className="card p-4 animate-pulse">
                      <div className="h-4 bg-line rounded w-1/2 mb-2" />
                      <div className="h-8 bg-line rounded w-3/4 mb-2" />
                      <div className="h-3 bg-line rounded w-1/3" />
                    </div>
                  );
                }

                return (
                  <Tile
                    key={tile.id}
                    type={tile.type}
                    title={tile.title}
                    subtitle={tile.subtitle}
                    value={tileValue}
                    onClick={() => {
                      // TODO: Navigate to drill target
                      console.log('Drill to:', tile.drillTarget, tile.drillFilters);
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-6 bg-acc rounded-full" />
          <h2 className="font-disp font-bold text-[18px] tracking-tight">
            Quick Actions
          </h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Requisition', icon: Plus },
            { label: 'DPR', icon: Plus },
            { label: 'Measurement', icon: Plus },
            { label: 'Material Request', icon: Plus },
            { label: 'Task', icon: Plus },
          ].map((action) => (
            <motion.button
              key={action.label}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="card p-3 text-left hover:shadow-lg transition-shadow cursor-pointer bg-side text-white"
            >
              <action.icon size={16} className="mb-2" />
              <div className="font-disp font-bold text-[13px]">
                {action.label}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
