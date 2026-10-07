import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

export default function PatientDashboard() {
  const [selectedDate, setSelectedDate] = useState(    //date
    new Date().toISOString().split('T')[0]
  );
  const [vitalsData, setVitalsData] = useState([]);     //sys,dia,hr like data
  const [eventsData, setEventsData] = useState([]);

  // Form State
  const [activityType, setActivityType] = useState('Medication');  //when add new activity event type
  const [eventTime, setEventTime] = useState('14:02');             //event added i=time
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchAnalyticsData(selectedDate);        //send selecteddate as a parameter for function
  }, [selectedDate]);

  const fetchAnalyticsData = async (date) => {
    try {
      const res = await axios.get(
        `http://localhost:8000/api/patient-activity-analytics?selected_date=${date}`
      );

      //save backend data
      const rawVitals = res.data.vitals || [];
      const rawEvents = res.data.events || [];

      // 1. Vitals data map  (Timestamp comparison )
      const formattedVitals = rawVitals.map((v) => ({
        ...v,
        timestampMs: new Date(v.created_at).getTime()
      }));

      // 2. tooltip add - cursr ek geniccm penn
      const mappedVitals = formattedVitals.map((v) => {
        const matchedEvents = rawEvents.filter((ev) => {
          const evMs = new Date(ev.event_time).getTime();
          // Vital record and Event relationship < (60000ms) 1min -  match (disply event)
          return Math.abs(evMs - v.timestampMs) < 60000;
        });

        //add to matched events  record or put null
        return {
          ...v,
          events: matchedEvents.length > 0 ? matchedEvents : null
        };
      });

      //sve data into status
      setVitalsData(mappedVitals);
      setEventsData(rawEvents);
    } catch (err) {
      console.error('Data loading error:', err);
    }
  };

  //save added event in backend/db
  const handleAddEvent = async (e) => {
    e.preventDefault();
    
    //To solve Timezone issue create  local string as a Date object and ISO conversion 
    const localDateTime = new Date(`${selectedDate}T${eventTime}:00`);
    const fullTimestamp = localDateTime.toISOString();

    try {
      await axios.post('http://localhost:8000/api/patient-events', {
        event_time: fullTimestamp,
        activity_type: activityType,
        notes: notes
      });
      setNotes('');
      fetchAnalyticsData(selectedDate);
    } catch (err) {
      console.error('Event save error:', err);
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'Exercise':
        return '#ef4444'; 
      case 'Medication':
        return '#3b82f6'; 
      case 'Meditation':
        return '#10b981'; 
      case 'Sleep':
        return '#8b5cf6'; 
      default:
        return '#f59e0b'; // Amber
    }
  };

  // Custom Tooltip Component - curser disply all data in chart
  //active - mouse on chart
   //payload- array contaion data 
   //label - relevent point x axix value
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const events = dataPoint.events;

      return (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            padding: '12px',
            borderRadius: '8px',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '200px'
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#94a3b8' }}>
            ⏰ <strong>Time:</strong>{' '}
            {new Date(label).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
            <span style={{ color: '#60a5fa' }}>
              Systolic BP: <strong>{dataPoint.systolic_bp} mmHg</strong>
            </span>
            <span style={{ color: '#38bdf8' }}>
              Diastolic BP: <strong>{dataPoint.diastolic_bp} mmHg</strong>
            </span>
            <span style={{ color: '#f43f5e' }}>
              Heart Rate: <strong>{dataPoint.heart_rate} bpm</strong>
            </span>
          </div>

          {events && events.length > 0 && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '1px solid #334155'
              }}
            >
              {events.map((ev, idx) => (
                <div
                  key={ev.id || idx}
                  style={{
                    backgroundColor: '#1e293b',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    marginBottom: '4px'
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: getActivityColor(ev.activity_type),
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                  >
                    📌 {ev.activity_type}
                  </p>
                  {ev.notes && (
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#cbd5e1' }}>
                      {ev.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#0f172a', color: '#fff', minHeight: '100vh' }}>
      <h2>Patient Activity & Vitals Dashboard</h2>

      {/* Control Bar */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          margin: '20px 0',
          alignItems: 'center',
          backgroundColor: '#1e293b',
          padding: '16px',
          borderRadius: '8px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <label style={{ marginRight: '10px' }}>Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
          />
        </div>

        <form onSubmit={handleAddEvent} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
          >
            <option value="Medication">Medication</option>
            <option value="Exercise">Exercise</option>
            <option value="Meditation">Meditation</option>
            <option value="Sleep">Sleep</option>
          </select>
          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
            required
          />
          <input
            type="text"
            placeholder="Notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff' }}
          />
          <button
            type="submit"
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Add Event
          </button>
        </form>
      </div>

      {/* Main Analytics Chart Canvas */}
      <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', height: '480px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={vitalsData} margin={{ top: 25, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="created_at"
              tickFormatter={(timeStr) =>
                new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              stroke="#94a3b8"
            />
            <YAxis domain={[40, 180]} stroke="#94a3b8" />
            <Tooltip content={<CustomTooltip />} />

            {/* Vitals Data Lines */}
            <Line type="monotone" dataKey="systolic_bp" stroke="#60a5fa" name="Systolic BP" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="diastolic_bp" stroke="#38bdf8" name="Diastolic BP" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="heart_rate" stroke="#f43f5e" name="Heart Rate" strokeWidth={2} dot={false} />

            {/* Vertical Annotations for Events */}
            {vitalsData.length > 0 &&
              eventsData.map((ev) => {
                const evMs = new Date(ev.event_time).getTime();

                // Chart එකේ ළඟම තියෙන Vitals timestamp point එක සොයාගැනීම
                const matchedPoint = vitalsData.reduce((closest, current) => {
                  const currentDiff = Math.abs(current.timestampMs - evMs);
                  const closestDiff = Math.abs(closest.timestampMs - evMs);
                  return currentDiff < closestDiff ? current : closest;
                }, vitalsData[0]);

                if (!matchedPoint) return null;

                return (
                  <ReferenceLine
                    key={ev.id || `${ev.event_time}-${ev.activity_type}`}
                    x={matchedPoint.created_at}
                    stroke={getActivityColor(ev.activity_type)}
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `📌 ${ev.activity_type}`,
                      position: 'top',
                      fill: getActivityColor(ev.activity_type),
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}
                  />
                );
              })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}