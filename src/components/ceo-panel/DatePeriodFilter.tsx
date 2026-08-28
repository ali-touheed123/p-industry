'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

interface DatePeriodFilterProps {
  startDate: string;
  endDate: string;
  onChangeStartDate: (date: string) => void;
  onChangeEndDate: (date: string) => void;
}

export const DatePeriodFilter: React.FC<DatePeriodFilterProps> = ({
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {/* Label with Calendar Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#C6A15B' }}>
        <Calendar style={{ width: '15px', height: '15px' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#E5E7EB' }}>
          Date Period:
        </span>
      </div>

      {/* FROM Date Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#10141B',
          border: '1px solid #2A2F38',
          borderRadius: '6px',
          padding: '4px 10px',
        }}
      >
        <span
          className="ceo-font-mono"
          style={{ fontSize: '11px', fontWeight: 700, color: '#8B93A1' }}
        >
          FROM:
        </span>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChangeStartDate(e.target.value)}
          className="ceo-font-mono"
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '12px',
            fontWeight: 600,
            color: '#E5E7EB',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Arrow separator */}
      <span style={{ color: '#8B93A1', fontSize: '12px' }}>→</span>

      {/* TO Date Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#10141B',
          border: '1px solid #2A2F38',
          borderRadius: '6px',
          padding: '4px 10px',
        }}
      >
        <span
          className="ceo-font-mono"
          style={{ fontSize: '11px', fontWeight: 700, color: '#8B93A1' }}
        >
          TO:
        </span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChangeEndDate(e.target.value)}
          className="ceo-font-mono"
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            fontSize: '12px',
            fontWeight: 600,
            color: '#E5E7EB',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
};
