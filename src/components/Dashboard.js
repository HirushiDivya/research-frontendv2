import React, { useState, useEffect, useRef } from 'react';
import { LineChart, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Heart, Activity, Gauge } from 'lucide-react';
import ResearchTrends from './ResearchTrends';
 

const DashboardLayout = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState([]);                 //create array fo store dat points use for chart
  const [latest, setLatest] = useState({
    inst_hr: 0,
    avg_hr: 0,
    bp_sys: 120,
    bp_dia: 80, 
    pulse_interval: 0
  });
  const [connected, setConnected] = useState(false);    //connection acivation check backend

  const [recentLogs, setRecentLogs] = useState([]);     //get last 20 ecords to sidply table 

  const startTimeRef = useRef(Date.now());

  // ESP32 Connection Status - check data come from backend
  const [espConnected, setEspConnected] = useState(false);
  const timerRef = useRef(null);

  const RawData = () => <div style={{ color: '#fff', padding: '20px' }}>Raw Data Section </div>;
  const Annotations = () => <div style={{ color: '#fff', padding: '20px' }}>Annotations Section </div>;
  const Settings = () => <div style={{ color: '#fff', padding: '20px' }}>Settings Section </div>;


  const OverviewContent = () => (
    <div style={{ padding: '20px', color: '#fff' }}>
      <h2>Cardiorespiratory Overview Dashboard</h2>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
      case 'Dashboard':
        return (
          <>
            
          </>
        );
      case 'trends':
        return <ResearchTrends />;
      case 'raw':
        return <RawData />;
      case 'annotations':
        return <Annotations />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  };


  useEffect(() => {

    // 1. Backend to Supabase Vital Logs (Recent 20) Fetch Function 
    const fetchRecentLogs = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/vital-logs/recent');
        const data = await response.json();

        const formatted = data.map((log) => {
          // Backend eken en created_at or timestamp value get
          const rawDate = log.created_at || log.timestamp;
          let formattedDateTime = "N/A";

          if (rawDate) {
            const dateObj = new Date(rawDate);
            //check row data valid or invalid
            //without being Invalid Date- ISO/Date string - Date + Time format 
            if (!isNaN(dateObj.getTime())) {
              const dateStr = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
              const timeStr = dateObj.toLocaleTimeString('en-US', { hour12: false }); // HH:mm:ss
              formattedDateTime = `${dateStr} ${timeStr}`;
            }
          }

          return {
            id: log.id,
            created_at: formattedDateTime, // Table  Display  Date & Time 
            heart_rate: log.heart_rate,
            systolic_bp: log.systolic_bp,
            diastolic_bp: log.diastolic_bp,
            pulse_interval: log.pulse_interval,
            patient_status: log.patient_status
          };
        });

        setRecentLogs(formatted);            //save those values in setformatted state
      } catch (err) {
        console.error("Error recieving data from backend:", err);
      }
    };

    // Component  Load - latest Logs disply
    fetchRecentLogs();

    // every 5 sec Records Auto-Fetch from db
    const logInterval = setInterval(() => {
      fetchRecentLogs();
    }, 5000);


    // Realtime WebSocket Connection 
    const ws = new WebSocket('ws://localhost:8000/ws/client');

    ws.onopen = () => setConnected(true);             //if connect sucesfully
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {           
      const payload = JSON.parse(event.data);              //json data convert to js object
      const isFingerDetected = payload.ir && payload.ir > 70000; 

      setEspConnected(true);

      // ESP32 Connection Timeout Check ( 4s) :if not recive any response from websocket
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setEspConnected(false);
      }, 4000);

      // Patient Status decide
      let status = 'Normal';
      if (!isFingerDetected) {
        status = 'No Finger';
      } else {
        status = payload.db_avg_status || 'Normal';
      }

    //upate setlatest state with latest data come from backend
      setLatest({
        ...payload,
        finger_detected: isFingerDetected,
        patient_status: status
      });

      // for graphs add Realtime PPG Waveform Data  (Date + Time )
      if (isFingerDetected) {
        setData((prevData) => {
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
          const timeStr = now.toLocaleTimeString('en-US', { hour12: false }); // HH:mm:ss
          const dateTimeString = `${dateStr} ${timeStr}`;

          //new array for store new data 
          const newData = [
            ...prevData,
            {
              time: dateTimeString, // "YYYY-MM-DD HH:mm:ss" Realtime timestamp 
              ir: payload.ir,
              pulse_interval: payload.pulse_interval || 0
            }
          ];

          if (newData.length > 80) newData.shift();
          return newData;
        });
      }
    };

    // Cleanup: when Component unmount/change to another scrreeen clear WebSocket and Interval 
    return () => {
      ws.close();
      clearInterval(logInterval);
    };
  }, []);



  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#175fa7' }}>
      {/*<Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />*/}


      <div style={{ flex: 1, padding: '20px', fontFamily: 'Arial, sans-serif', backgroundColor: '#0f172a', minHeight: '100vh' }}>

        {/*{renderContent()}

        {/* Top Section: Header + Patient Info + Metrics Cards */}
        <div style={{ marginBottom: '20px' }}>

          {/* Title & Connection Status Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#fff' }}>
              Advanced Cardiorespiratory Research Dashboard
            </h2>

            {/* Badges Container */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

              {/* Patient Status Badge */}
              <span style={{
                padding: '6px 14px',
                borderRadius: '20px',
                color: '#ffffff',
                backgroundColor:
                  latest?.patient_status === 'Critical' ? '#dc2626' : 
                    latest?.patient_status === 'Risky' ? '#f59e0b' :    
                      latest?.patient_status === 'No Finger' ? '#64748b' : '#16a34a', // Gray for No Finger, Green for Normal
                fontSize: '13px',
                fontWeight: '600'
              }}>
                ● Patient Status: {latest?.patient_status || 'Normal'}
              </span>


              {/* Finger Detection Badge */}
              <span style={{
                padding: '6px 14px',
                borderRadius: '20px',
                color: '#ffffff',
                backgroundColor: latest?.finger_detected ? '#16a34a' : '#eab308',
                fontSize: '13px',
                fontWeight: '600'
              }}>
                ● {latest?.finger_detected ? 'Finger Detected' : 'Finger Not Detected'}
              </span>


              {/* Connection Badge */}
              <span style={{
                padding: '6px 14px',
                borderRadius: '20px',
                color: '#ffffff',
                backgroundColor: (connected && espConnected) ? '#16a34a' : '#dc2626', // both Active -> green color
                fontSize: '13px',
                fontWeight: '600'
              }}>
                ● {(connected && espConnected) ? 'ESP32 Connected & Syncing' : 'ESP32 Disconnected'}
              </span>

            </div>
          </div>

          {/* Row: Patient Info + 3 Cards Panel */}
          <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch', flexWrap: 'wrap' }}>

            {/* 1. Patient Information Box */}
            <div style={{
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              padding: '16px 20px',
              borderRadius: '8px',
              minWidth: '280px',
              flex: '1'
            }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>
                Patient Information
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#fff', minWidth: '90px' }}>User Name:</span>
                  <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{latest?.user_id || 'Hirushi Divyanjalie'}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#fff', minWidth: '90px' }}>User Age:</span>
                  <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{latest?.user_age || '24'}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#fff', minWidth: '90px' }}>Blood Group:</span>
                  <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{latest?.user_blood_type || 'O+'}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#fff', minWidth: '90px' }}>Current Time:</span>
                  <span style={{ color: '#cbd5e1' }}>
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#fff', minWidth: '90px' }}>Patient Status:</span>
                  <span style={{
                    fontWeight: 'bold',
                    color: latest?.patient_status === 'Critical' ? '#ef4444' :
                      latest?.patient_status === 'Risky' ? '#f59e0b' :
                        latest?.patient_status === 'No Finger' ? '#94a3b8' : '#22c55e'
                  }}>
                    {latest?.patient_status || 'Normal'}
                  </span>
                </div>
              </div>
            </div>

            

            {/*  Real-Time Metrics Cards Container */}
            <div style={{ flex: '3', display: 'flex', flexDirection: 'column', gap: '6px' }}>
             {/* <span style={{ fontSize: '1px', fontWeight: 'bold', color: '#64748b' }}>Real-Time Metrics</span> */}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>

                {/* Heart Rate Card */}
                <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '15px', borderRadius: '8px' ,minHeight: '125px'}}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '20px', fontWeight: '600' }}>
                    <Heart size={30} /> Heart Rate
                  </div>
                  <h1 style={{ margin: '10px 0 0 0', fontSize: '40px' }}>
                    {latest.avg_hr} <small style={{ fontSize: '12px', color: '#94a3b8' }}>BPM</small>
                  </h1>
                </div>

                {/* Blood Pressure Card */}
                <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontSize: '20px', fontWeight: '600' }}>
                    <Gauge size={30} /> Blood Pressure
                  </div>
                  <h1 style={{ margin: '10px 0 0 0', fontSize: '40px' }}>
                    {latest.bp_sys}/{latest.bp_dia} <small style={{ fontSize: '12px', color: '#94a3b8' }}>mmHg</small>
                  </h1>
                </div>

                {/* Pulse Interval Card */}
                <div style={{ backgroundColor: '#1e293b', color: '#fff', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontSize: '20px', fontWeight: '600' }}>
                    <Activity size={30} /> Pulse Interval
                  </div>
                  <h1 style={{ margin: '10px 0 0 0', fontSize: '40px' }}>
                    {latest.pulse_interval} <small style={{ fontSize: '12px', color: '#94a3b8' }}>ms</small>
                  </h1>
                </div>

              </div>
            </div>

          </div>
        </div>


        {/* Live Graph */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#f8fafc' }}>Real-time PPG Waveform</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" interval="preserveStartEnd" minTickGap={30} stroke="#94a3b8" />
                <YAxis domain={['auto', 'auto']} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '6px' }}
                  itemStyle={{ color: '#a78bfa' }}
                />
                <Line
                  type="monotone"
                  dataKey="ir"
                  stroke="#8884d8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false} /* Jump stop */
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>



        {/* Live Pulse Interval Graph */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <Activity size={20} color="#4ade80" />
            <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Real-time Pulse Interval Dynamics</h3>
          </div>

          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12}  interval="preserveStartEnd" minTickGap={30} />
                <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={12} unit=" ms" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '6px' }}
                  itemStyle={{ color: '#4ade80' }}
                />
                <Line
                  type="monotone"
                  dataKey="pulse_interval"
                  stroke="#4ade80"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#4ade80' }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>




        {/* Recent Vital Logs Table */}
        <div style={{ background: '#1e293b', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#e4e1e1' }}>Recent Vital Logs (Last 20 Records)</h3>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>Live Data Feed</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #e2e8f0', color: '#94a3b8' }}>
                  <th style={{ padding: '12px' }}>Time</th>
                  <th style={{ padding: '12px' }}>Heart Rate (BPM)</th>
                  <th style={{ padding: '12px' }}>Systolic BP</th>
                  <th style={{ padding: '12px' }}>Diastolic BP</th>
                  <th style={{ padding: '12px' }}>Pulse Interval (ms)</th>
                  <th style={{ padding: '12px' }}>Patient Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      No data logs available yet...
                    </td>
                  </tr>
                ) : (
                  recentLogs.slice(0, 20).map((log, index) => (
                    <tr key={log.id || index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                        {log.created_at || 'N/A'}
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600', color: '#cbd5e1' }}>{log.heart_rate}</td>
                      <td style={{ padding: '12px', color: '#cbd5e1' }}>{log.systolic_bp}</td>
                      <td style={{ padding: '12px', color: '#cbd5e1' }}>{log.diastolic_bp}</td>
                      <td style={{ padding: '12px', color: '#cbd5e1' }}>{log.pulse_interval}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#ffffff',
                          backgroundColor:
                            log.patient_status === 'Critical' ? '#dc2626' :
                              log.patient_status === 'Risky' ? '#f59e0b' :
                                log.patient_status === 'No Finger' ? '#64748b' : '#16a34a'
                        }}>
                          {log.patient_status || 'Normal'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;