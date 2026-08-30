import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Map, Network, TrendingUp,
  AlertTriangle, Search, Shield, ChevronRight, FileText, Database, Bell, PanelsTopLeft
} from 'lucide-react';

import Dashboard    from './pages/Dashboard';
import GeoMap       from './pages/GeoMap';
import NetworkGraph from './pages/NetworkGraph';
import Trends       from './pages/Trends';
import Alerts       from './pages/Alerts';
import SearchPage   from './pages/SearchPage';
import Predictions  from './pages/Predictions';
import FIRIntake    from './pages/FIRIntake';
import DataDirectory from './pages/DataDirectory';
import NewUpdates from './pages/NewUpdates';
import DataCards from './pages/DataCards';

const NAV = [
  { to: '/crime-dashboard', icon: LayoutDashboard, label: 'Crime Dashboard' },
  { to: '/fir-dashboard',   icon: FileText,        label: 'FIR Dashboard'   },
  { to: '/map',         icon: Map,             label: 'Crime Map'    },
  { to: '/network',     icon: Network,         label: 'Link Analysis'},
  { to: '/trends',      icon: TrendingUp,      label: 'Trends'       },
  { to: '/alerts',      icon: AlertTriangle,   label: 'Alerts'       },
  { to: '/updates',     icon: Bell,            label: 'New Updates'  },
  { to: '/datacards',   icon: PanelsTopLeft,   label: 'DataCards'    },
  { to: '/fir-intake',  icon: FileText,        label: 'FIR Intake'   },
  { to: '/predictions', icon: Shield,          label: 'Predictions'  },
  { to: '/search',      icon: Search,          label: 'Search'       },
];

export default function App() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 900);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className={`flex flex-shrink-0 flex-col bg-slate-900 border-r border-slate-700 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700">
          <div className="w-8 h-8 rounded-md border border-slate-600 bg-slate-800 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-blue-400" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold text-white leading-tight">KSP Intelligence</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Operations Analytics</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-md border text-sm transition-colors ${
                  isActive
                    ? 'border-slate-700 bg-slate-800 text-white'
                    : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon size={17} className="flex-shrink-0 text-blue-400" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700 px-2 py-3">
          <NavLink
            to="/data-directory"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md border text-sm transition-colors ${
                isActive
                  ? 'border-slate-700 bg-slate-800 text-white'
                  : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-800/60 hover:text-white'
              }`
            }
          >
            <Database size={17} className="flex-shrink-0 text-blue-400" />
            {!collapsed && <span>Data Directory</span>}
          </NavLink>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center justify-center p-3 border-t border-slate-700 text-slate-500 hover:bg-slate-800 hover:text-white"
        >
          <ChevronRight size={16} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main */}
      <main className="w-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <Routes>
          <Route path="/"            element={<Dashboard mode="crime" />} />
          <Route path="/crime-dashboard" element={<Dashboard mode="crime" />} />
          <Route path="/fir-dashboard" element={<Dashboard mode="fir" />} />
          <Route path="/map"         element={<GeoMap />} />
          <Route path="/network"     element={<NetworkGraph />} />
          <Route path="/trends"      element={<Trends />} />
          <Route path="/alerts"      element={<Alerts />} />
          <Route path="/updates"     element={<NewUpdates />} />
          <Route path="/datacards"   element={<DataCards />} />
          <Route path="/fir-intake"  element={<FIRIntake />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/search"      element={<SearchPage />} />
          <Route path="/data-directory" element={<DataDirectory />} />
        </Routes>
      </main>
    </div>
  );
}
