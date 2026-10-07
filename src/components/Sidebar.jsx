import React, { useState } from 'react';
import { Home, TrendingUp, Database, Edit3, Settings, X, User } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [showProfile, setShowProfile] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: <Home size={20} /> },
    { id: 'trends', label: 'Research Trends', icon: <TrendingUp size={20} /> },
    { id: 'annotations', label: 'Annotations', icon: <Edit3 size={20} /> },
    {/* { id: 'raw', label: 'Raw Data', icon: <Database size={20} /> }, */ },
     {/* { id: 'settings', label: 'User Settings', icon: <Settings size={20} /> }, */ }
  ];

  return (
    <>
      {/* Side Navigation Bar */}
      <div style={{
        width: '90px',
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '20px',
        paddingBottom: '20px',
        minHeight: '100vh',
        boxSizing: 'border-box'
      }}>
        {/* Avatar 'A' Button */}
        <button
          onClick={() => setShowProfile(true)}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: '#334155',
            color: '#f8fafc',
            fontWeight: 'bold',
            fontSize: '18px',
            border: '2px solid #475569',
            cursor: 'pointer',
            marginBottom: '25px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: '0.2s'
          }}
          title="Click to view Patient Profile"
        >
          A
        </button>

        {/* Navigation Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  background: isActive ? '#1e293b' : 'transparent',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #38bdf8' : '3px solid transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 0',
                  cursor: 'pointer',
                  fontSize: '11px',
                  width: '100%'
                }}
              >
                {item.icon}
                <span style={{ textAlign: 'center', fontSize: '10px' }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Patient Personal Details Modal (Popup) */}
      {showProfile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            width: '320px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            position: 'relative',
            fontFamily: 'Arial, sans-serif'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowProfile(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <X size={20} />
            </button>

            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#1e88e5',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                A
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>Patient / Subject A</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>ID: SUB-2026-089</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />

            {/* Personal Details */}
            <div style={{ fontSize: '14px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><strong>Full Name:</strong> Hirushi Divyanjalie</div>
              <div><strong>Age:</strong> 24 Years</div>
              <div><strong>Gender:</strong> Female</div>
              <div><strong>Blood Group:</strong> O+</div>
              <div><strong>Height / Weight:</strong> 162 cm / 50 kg</div>
              <div><strong>Medical Condition:</strong> Baseline Monitoring</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;