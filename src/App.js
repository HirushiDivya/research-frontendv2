/*
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ResearchTrends from './components/ResearchTrends';
import Annotations from './components/TestAnnotations';
import Falldetectordashbord from './components/falldetector';

function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Falldetectordashbord />;
      case 'trends':
        return <ResearchTrends />;
        case 'annotations':
        return <Annotations />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
*/


import React from 'react';
import Falldetectordashbord from './components/falldetector';

function App() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Falldetectordashbord />
    </div>
  );
}

export default App;