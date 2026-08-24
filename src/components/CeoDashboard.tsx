'use client';

import React from 'react';
import { AuditLog, Tenant } from '@/types';
import { CeoSuite } from './ceo-panel/CeoSuite';

interface Props {
  auditLogs?: AuditLog[];
  todaySales?: number;
  slug?: string;
  tenant?: Tenant | null;
  onLogout?: () => void;
}

export default function CeoDashboard({ tenant, slug, onLogout }: Props) {
  return <CeoSuite tenant={tenant} initialBranchSlug={slug} onLogout={onLogout} />;
}