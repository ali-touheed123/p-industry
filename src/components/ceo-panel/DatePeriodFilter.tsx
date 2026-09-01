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
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#D97706' }}>
        <Calendar style={{ width: '15px', height: '15px' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
          Date Period:
        </span>
      </div>

      {/* FROM Date Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '6px',
          padding: '4px 10px',
        }}
      >
        <span
          className="ceo-font-mono"
          style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}
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
            color: '#0F172A',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* Arrow separator */}
      <span style={{ color: '#64748B', fontSize: '12px' }}>→</span>

      {/* TO Date Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '6px',
          padding: '4px 10px',
        }}
      >
        <span
          className="ceo-font-mono"
          style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}
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
            color: '#0F172A',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
};
