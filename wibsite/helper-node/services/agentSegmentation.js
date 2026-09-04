'use strict';

const fs = require('fs');
const path = require('path');

const SEG_DIR = path.join(__dirname, '..', 'data', 'agent_segments');
if (!fs.existsSync(SEG_DIR)) fs.mkdirSync(SEG_DIR, { recursive: true });

const DEFAULT_SEGMENTS = [
  { id: 'seg-hot-leads', name: 'Leads Calientes', description: 'Leads con score > 70', filters: { score_min: 70 }, auto_assign: true, tenant_id: null },
  { id: 'seg-new-leads', name: 'Leads Nuevos', description: 'Leads creados en últimas 24h', filters: { created_hours: 24 }, auto_assign: false, tenant_id: null },
  { id: 'seg-followup', name: 'Seguimiento Pendiente', description: 'Leads con follow-up programado', filters: { has_followup: true }, auto_assign: true, tenant_id: null },
  { id: 'seg-handoff', name: 'Handoffs Pendientes', description: 'Leads esperando handoff', filters: { status: 'handoff_pending' }, auto_assign: true, tenant_id: null },
  { id: 'seg-inactive', name: 'Leads Inactivos', description: 'Sin actividad en 14+ días', filters: { inactive_days: 14 }, auto_assign: false, tenant_id: null },
];

class AgentSegmentation {
  constructor() {
    this.segments = this._loadSegments();
  }

  createSegment(data) {
    const segment = {
      id: `seg-${Date.now()}`,
      name: data.name || 'New Segment',
      description: data.description || '',
      filters: data.filters || {},
      auto_assign: data.auto_assign || false,
      tenant_id: data.tenant_id || null,
      agent_id: data.agent_id || null,
      created_at: new Date().toISOString(),
    };
    this.segments.push(segment);
    this._saveSegments();
    return segment;
  }

  getSegment(segmentId) {
    return this.segments.find(s => s.id === segmentId) || null;
  }

  listSegments(tenantId = null) {
    if (tenantId) return this.segments.filter(s => s.tenant_id === tenantId || s.tenant_id === null);
    return this.segments;
  }

  updateSegment(segmentId, updates) {
    const idx = this.segments.findIndex(s => s.id === segmentId);
    if (idx === -1) return null;
    this.segments[idx] = { ...this.segments[idx], ...updates, updated_at: new Date().toISOString() };
    this._saveSegments();
    return this.segments[idx];
  }

  deleteSegment(segmentId) {
    const idx = this.segments.findIndex(s => s.id === segmentId);
    if (idx === -1) return false;
    this.segments.splice(idx, 1);
    this._saveSegments();
    return true;
  }

  filterLeads(leads, filters) {
    return leads.filter(lead => {
      for (const [key, value] of Object.entries(filters)) {
        if (key === 'score_min' && (lead.score || 0) < value) return false;
        if (key === 'score_max' && (lead.score || 0) > value) return false;
        if (key === 'status' && lead.status !== value) return false;
        if (key === 'created_hours') {
          const created = new Date(lead.created_at || Date.now());
          const hoursAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60);
          if (hoursAgo > value) return false;
        }
        if (key === 'inactive_days') {
          const updated = new Date(lead.updated_at || lead.created_at || Date.now());
          const daysAgo = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
          if (daysAgo < value) return false;
        }
        if (key === 'has_followup' && value && !lead.followup_date) return false;
        if (key === 'tag' && !(lead.tags || []).includes(value)) return false;
      }
      return true;
    });
  }

  assignLeadsToSegment(segmentId, leads) {
    const segment = this.getSegment(segmentId);
    if (!segment) return null;
    const matching = this.filterLeads(leads, segment.filters);
    return { segment_id: segmentId, total_leads: leads.length, matching: matching.length, leads: matching };
  }

  getSegmentsForLead(lead) {
    return this.segments.filter(segment => {
      const matching = this.filterLeads([lead], segment.filters);
      return matching.length > 0;
    });
  }

  getAutoAssignSegments(tenantId = null) {
    let segments = this.segments.filter(s => s.auto_assign);
    if (tenantId) segments = segments.filter(s => s.tenant_id === tenantId || s.tenant_id === null);
    return segments;
  }

  getStats() {
    const total = this.segments.length;
    const autoAssign = this.segments.filter(s => s.auto_assign).length;
    const tenantSpecific = this.segments.filter(s => s.tenant_id).length;
    return { total, auto_assign: autoAssign, tenant_specific: tenantSpecific, default: total - tenantSpecific };
  }

  _loadSegments() {
    const file = path.join(SEG_DIR, 'segments.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    return [...DEFAULT_SEGMENTS];
  }

  _saveSegments() {
    fs.writeFileSync(path.join(SEG_DIR, 'segments.json'), JSON.stringify(this.segments, null, 2));
  }
}

module.exports = { AgentSegmentation, DEFAULT_SEGMENTS };
