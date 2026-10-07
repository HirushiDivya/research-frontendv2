import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Heart, Activity, Gauge, Cpu, CheckCircle, Wifi, WifiOff } from 'lucide-react';

const ResearchTrends = () => {
  const [realtimeData, setRealtimeData] = useState({
    avg_hr: 0,
    bp_sys: 0,
    bp_dia: 0, 
    pulse_interval: 0,
    db_avg_status: 'Offline',
    status: 'Disconnected',
    timestamp: null,
  });

  const [longTermData, setLongTermData] = useState([]);    //to chart lines
  const [recentLogs, setRecentLogs] = useState([]);          //disply log table
  const [timeframe, setTimeframe] = useState('daily'); // 'last20', 'daily', 'monthly', 'lifetime'

  // States to track connections separately
  const [isServerConnected, setIsServerConnected] = useState(false); // backend fastapi -> frontend connectivity
  const [isEsp32Active, setIsEsp32Active] = useState(false);         // ESP32 connectivity

  const lastMsgTimeRef = useRef(Date.now());

  // WebSocket Connection & ESP32 Timeout Checker
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/client');

    ws.onopen = () => {
      console.log('Connected to Backend WebSocket');
      setIsServerConnected(true);
    };

    //active this when recive data from backend
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);    //json string -> json object
        setRealtimeData(data);

        lastMsgTimeRef.current = Date.now();
        setIsEsp32Active(true);
      } catch (err) {
        console.error('Error parsing WS data:', err);
      }
    };

    //connection close
    ws.onclose = () => {
      setIsServerConnected(false);
      setIsEsp32Active(false);
    };

    ws.onerror = () => {
      setIsServerConnected(false);
      setIsEsp32Active(false);
    };

    //if stop data recieve from backend check every 2 sec
    const timeoutCheck = setInterval(() => {
      if (Date.now() - lastMsgTimeRef.current > 4000) {
        setIsEsp32Active(false);
      }
    }, 2000);

    return () => {
      ws.close();
      clearInterval(timeoutCheck);
    };
  }, []);

  // Fetch Filtered Logs by Selected Timeframe
  const fetchLogsByTimeframe = async (selectedTimeframe) => {
    try {
      const response = await fetch(`http://localhost:8000/api/vital-logs/filtered?timeframe=${selectedTimeframe}`);
      const data = await response.json();           //convert recieve row data into json format

      if (Array.isArray(data) && data.length > 0) {
        setRecentLogs(data);                        //save recieve data into this state

        const formattedChartData = data
          .slice()
          .reverse()
          .map((item) => {
            const dateObj = new Date(item.created_at);

            let nameLabel = '';
            if (selectedTimeframe === 'daily' || selectedTimeframe === 'last20') {
              nameLabel = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } else {
              nameLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
            }

            return {
              name: nameLabel,
              hr: Number(item.heart_rate) || 0,
              sys: Number(item.systolic_bp) || 0,
              dia: Number(item.diastolic_bp) || 0,
              pi: Number(item.pulse_interval) || 0,
            };
          });

        setLongTermData(formattedChartData);
      } else {
        setRecentLogs([]);            //save to stats
        setLongTermData([]);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      setRecentLogs([]);
      setLongTermData([]);
    }
  };

  // Automatically refetch logs when timeframe changes or periodically every 10s
  useEffect(() => {
    fetchLogsByTimeframe(timeframe);
    const interval = setInterval(() => fetchLogsByTimeframe(timeframe), 10000);
    return () => clearInterval(interval);
  }, [timeframe]);

  //status update based on drobdown selected
  const handleTimeframeChange = (e) => {
    const newTimeframe = e.target.value;
    setTimeframe(newTimeframe);
  };

  // Calculated Average Values centered inside a 20-unit gap window
  const summaryStats = useMemo(() => {
    if (!recentLogs || recentLogs.length === 0) {
      return {
        hrRange: '0.0 - 0.0',
        bpRange: '0/0 - 0/0',
        piRange: '0 - 0',
        status: 'No Data',
        statusColor: '#94a3b8'
      };
    }

    //create arrays for store backend data
    const hrs = recentLogs.map((l) => Number(l.heart_rate)).filter(Boolean);
    const sysBps = recentLogs.map((l) => Number(l.systolic_bp)).filter(Boolean);
    const diaBps = recentLogs.map((l) => Number(l.diastolic_bp)).filter(Boolean);
    const pis = recentLogs.map((l) => Number(l.pulse_interval)).filter(Boolean);

    // Compute arithmetic averages
    const avgHr = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : 0;
    const avgSys = sysBps.length ? sysBps.reduce((a, b) => a + b, 0) / sysBps.length : 0;
    const avgDia = diaBps.length ? diaBps.reduce((a, b) => a + b, 0) / diaBps.length : 0;
    const avgPi = pis.length ? pis.reduce((a, b) => a + b, 0) / pis.length : 0;

    //identify status 
    // Fixed gap margin of 10 to ensure total range span = 20
    const margin = 10;

    const minHr = Math.max(0, avgHr - margin).toFixed(1);
    const maxHr = (avgHr + margin).toFixed(1);

    const minSys = Math.max(0, Math.round(avgSys - margin));
    const maxSys = Math.round(avgSys + margin);

    const minDia = Math.max(0, Math.round(avgDia - margin));
    const maxDia = Math.round(avgDia + margin);

    const minPi = Math.max(0, Math.round(avgPi - margin));
    const maxPi = Math.round(avgPi + margin);

    const hasCritical = recentLogs.some((l) => l.patient_status === 'Critical');
    const hasRisky = recentLogs.some((l) => l.patient_status === 'Risky');

    let overallStatus = 'Normal';
    let statusColor = '#22c55e';

    if (hasCritical) {
      overallStatus = 'Critical Warning';
      statusColor = '#ef4444';
    } else if (hasRisky) {
      overallStatus = 'Elevated Risk';
      statusColor = '#f59e0b';
    }

    return {
      hrRange: `${minHr} - ${maxHr}`,
      bpRange: `${minSys}/${minDia} - ${maxSys}/${maxDia}`,
      piRange: `${minPi} - ${maxPi}`,
      status: overallStatus,
      statusColor
    };
  }, [recentLogs]);

  const getStatusColor = (status) => {
    if (!isEsp32Active && status !== 'Normal') return '#94a3b8';
    if (status === 'Critical' || status === 'Critical Warning') return '#ef4444';
    if (status === 'Risky' || status === 'Elevated Risk') return '#f59e0b';
    return '#22c55e';
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>

      {/* Top Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Advanced Cardiorespiratory Research Dashboard</h2>
        </div>

        {/* Connection Status Indicator */}
        <div
          style={{
            backgroundColor: isServerConnected && isEsp32Active ? '#16a34a' : isServerConnected ? '#f59e0b' : '#dc2626',
            padding: '5px 15px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px'
          }}
        >
          {isServerConnected && isEsp32Active ? <Wifi size={16} /> : <WifiOff size={16} />}
          {!isServerConnected
            ? 'Server Offline'
            : isEsp32Active
              ? 'Connected & Syncing'
              : 'ESP32 Disconnected'}
        </div>
      </div>

      {/* Realtime Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 5px 0' }}>Patient Information</p>
          <p style={{ fontSize: '13px', margin: '3px 0' }}>
            Sensor State: <strong style={{ color: isEsp32Active ? '#22c55e' : '#ef4444' }}>{isEsp32Active ? realtimeData.status : 'Disconnected'}</strong>
          </p>
          <p style={{ fontSize: '13px', margin: '3px 0' }}>
            Timestamp: {isEsp32Active && realtimeData.timestamp ? new Date().toLocaleTimeString() : 'N/A'}
          </p>
          <p style={{ fontSize: '14px', margin: '5px 0 0 0', color: getStatusColor(realtimeData.db_avg_status), fontWeight: 'bold' }}>
            Status: {isEsp32Active ? realtimeData.db_avg_status : 'Offline'}
          </p>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
          <p style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '5px', margin: '0 0 5px 0' }}>
            <Heart size={16} /> Heart Rate
          </p>
          <h2 style={{ margin: '5px 0' }}>
            {isEsp32Active ? realtimeData.avg_hr : 0} <span style={{ fontSize: '14px', color: '#94a3b8' }}>BPM</span>
          </h2>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
          <p style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '5px', margin: '0 0 5px 0' }}>
            <Gauge size={16} /> Blood Pressure
          </p>
          <h2 style={{ margin: '5px 0' }}>
            {isEsp32Active ? `${realtimeData.bp_sys}/${realtimeData.bp_dia}` : '0/0'} <span style={{ fontSize: '14px', color: '#94a3b8' }}>mmHg</span>
          </h2>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
          <p style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px', margin: '0 0 5px 0' }}>
            <Activity size={16} /> Pulse Interval
          </p>
          <h2 style={{ margin: '5px 0' }}>
            {isEsp32Active ? realtimeData.pulse_interval : 0} <span style={{ fontSize: '14px', color: '#94a3b8' }}>ms</span>
          </h2>
        </div>
      </div>

      {/* Main Charts & Summary Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', minHeight: '340px' }}>
          <h3>Recent Vitals Trend ({timeframe.toUpperCase()})</h3>
          {longTermData.length > 0 ? (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={longTermData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                  <Line type="monotone" dataKey="hr" stroke="#f87171" name="Heart Rate (BPM)" strokeWidth={2} />
                  <Line type="monotone" dataKey="sys" stroke="#60a5fa" name="Systolic BP" strokeWidth={2} />
                  <Line type="monotone" dataKey="dia" stroke="#38bdf8" name="Diastolic BP" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '50px 0' }}>No historical data available for selected timeframe.</p>
          )}
        </div>

        {/* Dynamic Summary Card */}
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h4 style={{ margin: 0, fontSize: '15px' }}>Vitals Summary Range</h4>

              <select
                value={timeframe}
                onChange={handleTimeframeChange}
                style={{
                  backgroundColor: '#0f172a',
                  color: '#38bdf8',
                  border: '1px solid #334155',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="last20">Last 20 Records</option>
                <option value="daily">Daily (24h)</option>
                <option value="monthly">Monthly (30d)</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Heart Rate Range</span>
              <strong style={{ fontSize: '16px', color: '#f87171' }}>{summaryStats.hrRange}</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>bpm</span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Blood Pressure Range</span>
              <strong style={{ fontSize: '16px', color: '#60a5fa' }}>{summaryStats.bpRange}</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>mmHg</span>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Pulse Interval Range</span>
              <strong style={{ fontSize: '16px', color: '#34d399' }}>{summaryStats.piRange}</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>ms</span>
            </div>
          </div>

          <div style={{ paddingTop: '10px', borderTop: '1px solid #334155' }}>
            <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block' }}>Overall Period Risk:</span>
            <strong style={{ fontSize: '15px', color: summaryStats.statusColor }}>
              {summaryStats.status}
            </strong>
          </div>
        </div>
      </div>

      {/* Diagnostics & Complete Logs Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginTop: '20px' }}>

        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px' }}>
          <h3>Device & Sensor Diagnostics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>

            {/* ESP32 Connection Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu /> ESP32: <span style={{ color: isEsp32Active ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                {isEsp32Active ? 'Active' : 'Offline'}
              </span>
            </div>

            {/* MAX30102 Sensor Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle /> MAX30102: <span style={{ color: isEsp32Active && realtimeData.status !== 'No Finger Detected' ? '#22c55e' : '#f59e0b', fontWeight: 'bold' }}>
                {!isEsp32Active ? 'Offline' : realtimeData.status === 'No Finger Detected' ? 'No Finger' : 'Measuring'}
              </span>
            </div>

            {/* Battery Level & Charging Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🔋</span> Battery:
              <span style={{ color: !isEsp32Active ? '#94a3b8' : realtimeData.battery_level > 20 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                {!isEsp32Active ? 'N/A' : `${realtimeData.battery_level ?? 0}%`}
              </span>
              {isEsp32Active && (
                <span style={{ fontSize: '12px', color: realtimeData.is_charging ? '#22c55e' : '#94a3b8', marginLeft: '5px' }}>
                  ({realtimeData.is_charging ? '⚡ Charging' : 'Discharging'})
                </span>
              )}
            </div>

          </div>
        </div>


        {/* All Data Records Table */}
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', maxHeight: '400px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Database Records ({timeframe.toUpperCase()})</h3>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold' }}>
              Total: {recentLogs.length} Records
            </span>
          </div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '10px', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', position: 'sticky', top: 0, backgroundColor: '#1e293b' }}>
                <th style={{ padding: '8px' }}>Time / Date</th>
                <th style={{ padding: '8px' }}>HR (BPM)</th>
                <th style={{ padding: '8px' }}>BP (mmHg)</th>
                <th style={{ padding: '8px' }}>Pulse Int (ms)</th>
                <th style={{ padding: '8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                    No records found for selected timeframe.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log, index) => (
                  <tr key={log.id || `${log.created_at}-${index}`} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '8px', color: '#cbd5e1' }}>
                      {timeframe === 'daily' || timeframe === 'last20'
                        ? new Date(log.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : new Date(log.created_at).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px', fontWeight: 'bold' }}>{log.heart_rate}</td>
                    <td style={{ padding: '8px' }}>{log.systolic_bp}/{log.diastolic_bp}</td>
                    <td style={{ padding: '8px' }}>{log.pulse_interval}</td>
                    <td style={{ padding: '8px', color: getStatusColor(log.patient_status), fontWeight: '600' }}>
                      {log.patient_status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};

export default ResearchTrends;