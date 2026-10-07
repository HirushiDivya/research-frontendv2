import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, Legend, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Heart, Activity, Gauge, Cpu, CheckCircle, Wifi, WifiOff, Calendar, Clock, Edit3, Home, TrendingUp, Settings } from 'lucide-react';
export default function Falldetectordashbord() {
  // --- WebSocket & Real-time State ---
  const [data, setData] = useState([]);
  const [realtimeData, setRealtimeData] = useState({
    inst_hr: 0,
    avg_hr: 0,
    bp_sys: 120,
    bp_dia: 80,
    pulse_interval: 0,
    db_avg_status: 'Normal',
    status: 'Disconnected',
    battery_level: null,
    is_charging: false,
    timestamp: null,
  });

  const [latest, setLatest] = useState({
    inst_hr: 0,
    avg_hr: 0,
    bp_sys: 120,
    bp_dia: 80,
    pulse_interval: 0,
    finger_detected: false,
    patient_status: 'Normal'
  });

  //dashbord
  const [connected, setConnected] = useState(false);    //connection acivation check backend
  const [recentLogs, setRecentLogs] = useState([]);     //get last 20 ecords to sidply table 
  const startTimeRef = useRef(Date.now());
  // ESP32 Connection Status - check data come from backend
  const [espConnected, setEspConnected] = useState(false);
  const timerRef = useRef(null);
  const RawData = () => <div style={{ color: '#fff', padding: '20px' }}>Raw Data Section </div>;
  const Annotations = () => <div style={{ color: '#fff', padding: '20px' }}>Annotations Section </div>;
  const Settings = () => <div style={{ color: '#fff', padding: '20px' }}>Settings Section </div>;





  const [isServerConnected, setIsServerConnected] = useState(false);
  const [isEsp32Active, setIsEsp32Active] = useState(false);
  const lastMsgTimeRef = useRef(Date.now());

  // --- Trends & Data States ---
  const [longTermData, setLongTermData] = useState([]);
  const [timeframe, setTimeframe] = useState('daily');

  // --- Patient Analytics & Annotations State ---
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [vitalsData, setVitalsData] = useState([]);
  const [eventsData, setEventsData] = useState([]);
  const [activityType, setActivityType] = useState('Medication');
  const [eventTime, setEventTime] = useState('14:02');
  const [notes, setNotes] = useState('');

  // 1. WebSocket Setup
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/client');

    ws.onopen = () => setIsServerConnected(true);


    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setRealtimeData(payload);
        lastMsgTimeRef.current = Date.now();
        setIsEsp32Active(true);

        const isFingerDetected = payload.ir && payload.ir > 70000;

        if (isFingerDetected) {
          setData((prevData) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

            const newData = [
              ...prevData,
              {
                time: timeStr,
                ir: payload.ir,
                pulse_interval: payload.pulse_interval || 0,
              },
            ];

            if (newData.length > 80) newData.shift();
            return newData;
          });
        }
      } catch (err) {
        console.error('Error parsing WS data:', err);
      }
    };

 
    ws.onclose = () => { setIsServerConnected(false); setIsEsp32Active(false); };
    ws.onerror = () => { setIsServerConnected(false); setIsEsp32Active(false); };

    const timeoutCheck = setInterval(() => {
      if (Date.now() - lastMsgTimeRef.current > 4000) setIsEsp32Active(false);
    }, 2000);

    return () => {
      ws.close();
      clearInterval(timeoutCheck);
    };
  }, []);


  // Bucket-wise average calculator for Module 3 chart
  const buildAveragedChartData = (logs, tf) => {
    // DAILY / LAST20: raw points (ResearchTrends wage)
    if (tf === 'daily' || tf === 'last20') {
      const raw = logs.slice().reverse().map((item) => ({
        name: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        hr: Number(item.heart_rate) || null,
        sys: Number(item.systolic_bp) || null,
        dia: Number(item.diastolic_bp) || null,
      }));

      // records godak unoth chart eka slow wenna puluwan, hinda max ~300 points walata adu karanawa
      const step = Math.ceil(raw.length / 300);
      return step > 1 ? raw.filter((_, i) => i % step === 0) : raw;
    }

    // MONTHLY / LIFETIME: day-wise average
    const buckets = {};
    logs.forEach((item) => {
      const d = new Date(item.created_at);
      if (isNaN(d.getTime())) return;
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);

      const key = start.getTime();
      if (!buckets[key]) buckets[key] = { start, hr: [], sys: [], dia: [] };

      const hr = Number(item.heart_rate);
      const sys = Number(item.systolic_bp);
      const dia = Number(item.diastolic_bp);
      if (hr) buckets[key].hr.push(hr);
      if (sys) buckets[key].sys.push(sys);
      if (dia) buckets[key].dia.push(dia);
    });

    const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

    return Object.keys(buckets)
      .sort((a, b) => a - b)
      .map((key) => {
        const b = buckets[key];
        return {
          name: b.start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          hr: avg(b.hr),
          sys: avg(b.sys),
          dia: avg(b.dia),
        };
      });
  };


  // 2. Fetch Log Data
  const fetchLogsByTimeframe = async (selectedTimeframe) => {
    try {
      const response = await fetch(`http://localhost:8000/api/vital-logs/filtered?timeframe=${selectedTimeframe}`);
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setRecentLogs(data);
        setLongTermData(buildAveragedChartData(data, selectedTimeframe));
      } else {
        setRecentLogs([]);
        setLongTermData([]);
      }
    } catch (error) {
      setRecentLogs([]);
      setLongTermData([]);
    }
  };

  useEffect(() => {

    //tends
    const buildAveragedChartData = (logs, tf) => {
      const buckets = {};

      logs.forEach((item) => {
        const d = new Date(item.created_at);
        if (isNaN(d.getTime())) return;

        const start = new Date(d);
        if (tf === 'daily') start.setMinutes(0, 0, 0);   // hour bucket
        else start.setHours(0, 0, 0, 0);                  // day bucket

        const key = start.getTime();
        if (!buckets[key]) {
          buckets[key] = { start, hr: [], sys: [], dia: [] };
        }

        const hr = Number(item.heart_rate);
        const sys = Number(item.systolic_bp);
        const dia = Number(item.diastolic_bp);
        if (hr) buckets[key].hr.push(hr);
        if (sys) buckets[key].sys.push(sys);
        if (dia) buckets[key].dia.push(dia);
      });

      const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

      return Object.keys(buckets)
        .sort((a, b) => a - b)
        .map((key) => {
          const b = buckets[key];
          return {
            name: tf === 'daily'
              ? b.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
              : b.start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            hr: avg(b.hr),
            sys: avg(b.sys),
            dia: avg(b.dia),
          };
        });
    };




    fetchLogsByTimeframe(timeframe);
    const interval = setInterval(() => fetchLogsByTimeframe(timeframe), 10000);
    return () => clearInterval(interval);
  }, [timeframe]);

  // 3. Analytics & Event Data
  const fetchAnalyticsData = async (date) => {
    try {
      const res = await axios.get(`http://localhost:8000/api/patient-activity-analytics?selected_date=${date}`);
      const rawVitals = res.data.vitals || [];
      const rawEvents = res.data.events || [];

      const formattedVitals = rawVitals.map((v) => ({ ...v, timestampMs: new Date(v.created_at).getTime() }));
      const mappedVitals = formattedVitals.map((v) => {
        const matchedEvents = rawEvents.filter((ev) => Math.abs(new Date(ev.event_time).getTime() - v.timestampMs) < 60000);
        return { ...v, events: matchedEvents.length > 0 ? matchedEvents : null };
      });

      setVitalsData(mappedVitals);
      setEventsData(rawEvents);
    } catch (err) {
      console.error('Analytics Error:', err);
    }
  };

  useEffect(() => { fetchAnalyticsData(selectedDate); }, [selectedDate]);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    const localDateTime = new Date(`${selectedDate}T${eventTime}:00`);
    try {
      await axios.post('http://localhost:8000/api/patient-events', {
        event_time: localDateTime.toISOString(),
        activity_type: activityType,
        notes: notes
      });
      setNotes('');
      fetchAnalyticsData(selectedDate);
    } catch (err) {
      console.error('Save Event Error:', err);
    }
  };

  // Vitals Summary Calculations
  const summaryStats = useMemo(() => {
    if (!recentLogs.length) return { hrRange: '0.0 - 0.0', bpRange: '0/0 - 0/0', piRange: 'N/A', status: 'No Data' };
    const hrs = recentLogs.map((l) => Number(l.heart_rate)).filter(Boolean);
    const sysBps = recentLogs.map((l) => Number(l.systolic_bp)).filter(Boolean);
    const diaBps = recentLogs.map((l) => Number(l.diastolic_bp)).filter(Boolean);
    const pis = recentLogs.map((l) => Number(l.pulse_interval)).filter(Boolean);

    const avgHr = hrs.length ? hrs.reduce((a, b) => a + b, 0) / hrs.length : 0;
    const avgSys = sysBps.length ? sysBps.reduce((a, b) => a + b, 0) / sysBps.length : 0;
    const avgDia = diaBps.length ? diaBps.reduce((a, b) => a + b, 0) / diaBps.length : 0;
    const avgPi = pis.length ? pis.reduce((a, b) => a + b, 0) / pis.length : 0;

    return {
      hrRange: `${Math.max(0, avgHr - 10).toFixed(1)} - ${(avgHr + 10).toFixed(1)}`,
      bpRange: `${Math.max(0, Math.round(avgSys - 10))}/${Math.max(0, Math.round(avgDia - 10))} - ${Math.round(avgSys + 10)}/${Math.round(avgDia + 10)}`,
      piRange: `${Math.max(0, Math.round(avgPi - 10))} - ${Math.round(avgPi + 10)}`,
      status: recentLogs.some(l => l.patient_status === 'Critical') ? 'Critical Warning' : 'Normal'
    };
  }, [recentLogs]);

  const getActivityColor = (type) => {
    switch (type) {
      case 'Exercise': return '#ef4444';
      case 'Medication': return '#2563eb';
      case 'Meditation': return '#10b981';
      case 'Sleep': return '#8b5cf6';
      default: return '#f59e0b';
    }
  };

  const annotationChartData = useMemo(() => {
    const BUCKET = 5 * 60 * 1000;      // 5 min average
    const GAP = 15 * 60 * 1000;        // meke wadi gap ekak unoth line eka kapanawa
    const buckets = {};

    vitalsData.forEach((v) => {
      const hr = Number(v.heart_rate);
      if (!hr || isNaN(v.timestampMs)) return;
      const key = Math.floor(v.timestampMs / BUCKET) * BUCKET;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(hr);
    });

    const points = Object.keys(buckets)
      .map(Number)
      .sort((a, b) => a - b)
      .map((key) => ({
        ts: key,
        hr: Math.round(buckets[key].reduce((a, b) => a + b, 0) / buckets[key].length),
      }));

    // loku gap thiyena thæna null point ekak danawa
    const result = [];
    points.forEach((p, i) => {
      if (i > 0 && p.ts - points[i - 1].ts > GAP) {
        result.push({ ts: points[i - 1].ts + BUCKET, hr: null });
      }
      result.push(p);
    });
    return result;
  }, [vitalsData]);

  const annotationDomain = useMemo(() => {
    const times = [
      ...annotationChartData.map((d) => d.ts),
      ...eventsData.map((e) => new Date(e.event_time).getTime()),
    ].filter((t) => !isNaN(t));
    return times.length ? [Math.min(...times), Math.max(...times)] : ['auto', 'auto'];
  }, [annotationChartData, eventsData]);

  return (
    <div style={{ display: 'flex', backgroundColor: '#e2e8f0', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif', color: '#1e293b' }}>



      {/* Main Workspace */}
      <div style={{ flex: 1, padding: '20px 30px', overflowY: 'auto' }}>

        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Heart Rate & Blood Pressure Monoitoring Dashbord</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Header Right Side Status Badge */}
            <span style={{
              backgroundColor: '#e2e8f0',
              padding: '6px 12px',
              borderRadius: '15px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid #cbd5e1'
            }}>
              {isEsp32Active ? (
                <>
                  <Wifi size={14} color="#22c55e" />
                  <span style={{ fontWeight: 500 }}>ESP32: Active</span>
                  
                </>
              ) : (
                <>
                  <WifiOff size={14} color="#ef4444" />
                  <span>ESP32: Disconnected</span>
                </>
              )}
            </span>
            <span style={{ backgroundColor: '#e2e8f0', padding: '6px 12px', borderRadius: '15px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #cbd5e1' }}>

              <p style={{ margin: 0, fontSize: '12px', color: '#1a212c' }}>
                Patient Status:
                <span style={{
                  color: (isEsp32Active ? realtimeData.db_avg_status : summaryStats.status) === 'Critical' || (isEsp32Active ? realtimeData.db_avg_status : summaryStats.status) === 'Critical Warning' ? '#ef4444' : '#22c55e',
                  fontWeight: 'bold'
                }}>
                  {isEsp32Active ? realtimeData.db_avg_status : summaryStats.status}
                </span>
              </p>
            </span>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '20px' }}>

          {/* COLUMN 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>



            {/* Module 1: Patient Overview */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1e293b' }}>Patient Overview</h4>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                  <img src="data:image/webp;base64,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" alt="Patient" style={{ width: '100%', height: '100%' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Hirushi Divyanjalie</h3>
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#1a212c' }}>User Age: 24 | Blood Group: O+</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#1a212c' }}>Patient Status: <span style={{ color: '#22c55e', fontWeight: 'bold' }}>Normal</span></p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Heart size={12} color="#ef4444" /> Heart Rate</span>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', fontSize: '18px' }}>{isEsp32Active ? realtimeData.avg_hr : 0} <span style={{ fontSize: '12px' }}>BPM</span></p>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Gauge size={12} color="#2563eb" /> Blood Pressure</span>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', fontSize: '18px' }}>{isEsp32Active ? `${realtimeData.bp_sys}/${realtimeData.bp_dia}` : '120/80'} <span style={{ fontSize: '12px' }}>mmHg</span></p>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={12} color="#10b981" /> Pulse Interval</span>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', fontSize: '18px' }}>{isEsp32Active ? realtimeData.pulse_interval : 0} <span style={{ fontSize: '12px' }}>ms</span></p>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 15px 0' }}>Research Annotations</h4>
              <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  <select value={activityType} onChange={(e) => setActivityType(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                    <option value="Medication">Medication</option>
                    <option value="Exercise">Exercise</option>
                    <option value="Meditation">Meditation</option>
                    <option value="Sleep">Sleep</option>
                  </select>
                  <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="Notes..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                  <button type="submit" style={{ backgroundColor: '#0e7490', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>Add Event</button>
                </div>
              </form>
              <div style={{ height: '200px', backgroundColor: '#f8fafc', borderRadius: '6px', marginTop: '10px', border: '1px solid #e2e8f0' }}>
                {annotationChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={annotationChartData} margin={{ top: 20, right: 15, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={annotationDomain}
                        tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        stroke="#64748b"
                        fontSize={10}
                        tickCount={5}
                        height={38}
                        label={{ value: 'Time', position: 'insideBottom', offset: -2, fontSize: '11px', fill: '#64748b' }}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        stroke="#64748b"
                        fontSize={10}
                        width={55}
                        label={{ value: 'Heart Rate (BPM)', angle: -90, position: 'insideLeft', offset: 5, fontSize: '11px', fill: '#64748b', style: { textAnchor: 'middle' } }}
                      />
                      <Tooltip
                        labelFormatter={(t) => new Date(t).toLocaleTimeString()}
                        contentStyle={{ backgroundColor: '#ced5e7', borderColor: '#dae3f0', color: '#0c0c0c', borderRadius: '6px' }}
                        itemStyle={{ color: '#0c0b0b', fontSize: '12px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="hr"
                        name="Heart Rate (BPM)"
                        stroke="#252926"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                      {eventsData.map((ev, i) => (
                        <ReferenceLine
                          key={ev.id || i}
                          x={new Date(ev.event_time).getTime()}
                          stroke={getActivityColor(ev.activity_type)}
                          strokeWidth={2}
                          strokeDasharray="4 3"
                          label={{ value: ev.activity_type, position: 'top', fontSize: '10px', fill: getActivityColor(ev.activity_type) }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', paddingTop: '80px' }}>
                    No vitals data for {selectedDate}.
                  </p>
                )}
              </div>
            </div>



          </div>

          {/* COLUMN 2 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>



            {/* Module 2: Advanced PPG Diagnostics */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Advanced PPG Waveforms</h4>

              <span style={{ fontSize: '12px', color: '#64748b' }}>Real-time Heart Rate</span>
              <div style={{ height: '170px', backgroundColor: '#f8fafc', borderRadius: '6px', marginTop: '5px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>

                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={10}
                      interval="preserveStartEnd"
                      minTickGap={40}
                      tickMargin={4}
                      height={38}
                      label={{ value: 'Time', position: 'insideBottom', offset: -2, fontSize: '11px', fill: '#64748b' }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#64748b"
                      fontSize={10}
                      width={55}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      label={{ value: 'IR Signal', angle: -90, position: 'insideLeft', offset: 5, fontSize: '11px', fill: '#64748b', style: { textAnchor: 'middle' } }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ced5e7', borderColor: '#dae3f0', color: '#0a0a0a', borderRadius: '6px' }}
                      itemStyle={{ color: '#0f0f0f', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="ir" stroke="#252926" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>


              <span style={{ fontSize: '12px', color: '#64748b' }}>Real-time Pulse Interval Dynamics</span>
              <div style={{ height: '170px', backgroundColor: '#f8fafc', borderRadius: '6px', marginTop: '5px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>

                <ResponsiveContainer width="100%" height="100%">

                  <LineChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={10}
                      interval="preserveStartEnd"
                      minTickGap={40}
                      tickMargin={4}
                      height={38}
                      label={{ value: 'Time', position: 'insideBottom', offset: -2, fontSize: '11px', fill: '#64748b' }}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#64748b"
                      fontSize={10}
                      width={55}
                      tickFormatter={(v) => Math.round(v)}
                      label={{ value: 'Pulse Interval (ms)', angle: -90, position: 'insideLeft', offset: 5, fontSize: '11px', fill: '#64748b', style: { textAnchor: 'middle' } }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ced5e7', borderColor: '#dae3f0', color: '#0a0a0a', borderRadius: '6px' }}
                      itemStyle={{ color: '#111010', fontSize: '12px' }}
                      formatter={(v) => [`${v} ms`, 'Pulse Interval']}
                    />
                    <Line type="monotone" dataKey="pulse_interval" stroke="#252926" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>


              {/*
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Recent Vital Logs</span>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Live Data Feed</span>
              </div>

              <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th>Time</th><th>HR</th><th>Systolic BP</th><th>Diastolic BP</th><th>PI</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.slice(0, 4).map((log, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td>{new Date(log.created_at).toLocaleTimeString()}</td>
                      <td>{log.heart_rate}</td>
                      <td>{log.systolic_bp}</td>
                      <td>{log.diastolic_bp}</td>
                      <td>{log.pulse_interval}</td>
                      <td><span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '10px', fontSize: '10px' }}>{log.patient_status || 'Risky'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              */}
            </div>

            {/* Module 5: Device Health & Management */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Device Health</h4>
              <p style={{ fontWeight: 'bold', margin: '0 0 10px 0', fontSize: '14px' }}>Device & Sensor Diagnostics</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div><Cpu size={14} inline /> ESP32: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{isEsp32Active ? 'Active' : 'Offline'}</span></div>
                <div><CheckCircle size={14} inline /> MAX30102: <span style={{ color: '#d97706', fontWeight: 'bold' }}>Offline</span></div>
                <div>🔋 Battery: <span style={{ fontWeight: 'bold' }}>N/A</span></div>
              </div>
            </div>

          </div>

          {/* COLUMN 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Module 3: Historical Vitals Trends */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Historical Vitals Trends</h4>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Recent Vitals Trend ({timeframe.toUpperCase()})</span>

              <div style={{ height: '200px', backgroundColor: '#f8fafc', borderRadius: '6px', marginTop: '5px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
                {longTermData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={longTermData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={10}
                        interval="preserveStartEnd"
                        minTickGap={30}
                        tickMargin={4}
                        height={38}
                        label={{ value: timeframe === 'daily' ? 'Time (hourly avg)' : 'Date (daily avg)', position: 'insideBottom', offset: -2, fontSize: '11px', fill: '#64748b' }}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        stroke="#64748b"
                        fontSize={10}
                        width={55}
                        label={{ value: timeframe === 'daily' ? 'Time (10-min avg)' : 'Date (daily avg)', value: 'Average Value', angle: -90, position: 'insideLeft', offset: 5, fontSize: '11px', fill: '#64748b', style: { textAnchor: 'middle' } }}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#ced5e7', borderColor: '#dae3f0', color: '#070707', borderRadius: '6px' }}
                        itemStyle={{ color: '#0f0f0f', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: 10 }} />
                      <Line type="natural" dataKey="hr" name="Heart Rate (BPM)" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                      <Line type="natural" dataKey="sys" name="Systolic BP" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                      <Line type="natural" dataKey="dia" name="Diastolic BP" stroke="#38bdf8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ textAlign: 'center', fontSize: '11px', color: '#94a3b8', paddingTop: '60px' }}>No data for selected timeframe.</p>
                )}
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Vitals Summary Range</span>
                  <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} style={{ fontSize: '10px', padding: '2px 4px' }}>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Heart Rate</span>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#ef4444' }}>{summaryStats.hrRange} bpm</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Blood Pressure</span>
                    <p style={{ margin: 0, fontWeight: 'bold', color: '#2563eb' }}>{summaryStats.bpRange} mmHg</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Pulse Interval</span>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>{summaryStats.piRange}</p>
                  </div>
                </div>

                <p style={{ fontSize: '11px', margin: '10px 0 0 0', color: '#64748b' }}>
                  Status: <strong>{summaryStats.status}</strong>
                </p>
              </div>
            </div>

            {/* Database Records Block */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Database Records ({timeframe.toUpperCase()})</span>
                <span style={{ fontSize: '11px', color: '#0e7490' }}>Total: {recentLogs.length} Records</span>
              </div>

              <table style={{ width: '100%', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th>Time / Date</th><th>HR</th><th>BP</th><th>Pulse Int</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No records found for selected timeframe.</td></tr>
                  ) : (
                    recentLogs.slice(0, 5).map((log, index) => (
                      <tr key={index}>
                        <td>{new Date(log.created_at).toLocaleTimeString()}</td>
                        <td>{log.heart_rate}</td>
                        <td>{log.systolic_bp}/{log.diastolic_bp}</td>
                        <td>{log.pulse_interval}</td>
                        <td>{log.patient_status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

