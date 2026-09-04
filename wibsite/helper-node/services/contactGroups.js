'use strict';

const fs = require('fs');
const path = require('path');

const GROUPS_DIR = path.join(__dirname, '..', 'data', 'contact_groups');
if (!fs.existsSync(GROUPS_DIR)) fs.mkdirSync(GROUPS_DIR, { recursive: true });

class ContactGroups {
  constructor() {
    this.groups = this._loadGroups();
  }

  createGroup(data) {
    const group = {
      id: `grp-${Date.now()}`,
      name: data.name || 'New Group',
      description: data.description || '',
      type: data.type || 'manual',
      member_ids: data.member_ids || [],
      tenant_id: data.tenant_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.groups.push(group);
    this._saveGroups();
    return group;
  }

  getGroup(groupId) {
    return this.groups.find(g => g.id === groupId) || null;
  }

  listGroups(tenantId = null) {
    if (tenantId) return this.groups.filter(g => g.tenant_id === tenantId || g.tenant_id === null);
    return this.groups;
  }

  updateGroup(groupId, updates) {
    const idx = this.groups.findIndex(g => g.id === groupId);
    if (idx === -1) return null;
    this.groups[idx] = { ...this.groups[idx], ...updates, updated_at: new Date().toISOString() };
    this._saveGroups();
    return this.groups[idx];
  }

  deleteGroup(groupId) {
    const idx = this.groups.findIndex(g => g.id === groupId);
    if (idx === -1) return false;
    this.groups.splice(idx, 1);
    this._saveGroups();
    return true;
  }

  addMembers(groupId, leadIds) {
    const group = this.getGroup(groupId);
    if (!group) return null;
    const newMembers = leadIds.filter(id => !group.member_ids.includes(id));
    group.member_ids.push(...newMembers);
    group.updated_at = new Date().toISOString();
    this._saveGroups();
    return { group_id: groupId, added: newMembers.length, total: group.member_ids.length };
  }

  removeMembers(groupId, leadIds) {
    const group = this.getGroup(groupId);
    if (!group) return null;
    const before = group.member_ids.length;
    group.member_ids = group.member_ids.filter(id => !leadIds.includes(id));
    group.updated_at = new Date().toISOString();
    this._saveGroups();
    return { group_id: groupId, removed: before - group.member_ids.length, total: group.member_ids.length };
  }

  getMembers(groupId) {
    const group = this.getGroup(groupId);
    return group ? group.member_ids : [];
  }

  getGroupsForLead(leadId) {
    return this.groups.filter(g => g.member_ids.includes(leadId));
  }

  aiGroupleads(leads, criteria = {}) {
    const groups = {};
    for (const lead of leads) {
      let groupKey = 'ungrouped';
      if (criteria.by_score) {
        if (lead.score >= 70) groupKey = 'hot';
        else if (lead.score >= 40) groupKey = 'warm';
        else groupKey = 'cold';
      } else if (criteria.by_status) {
        groupKey = lead.status || 'unknown';
      } else if (criteria.by_tag) {
        groupKey = (lead.tags && lead.tags[0]) || 'untagged';
      } else if (criteria.by_sector) {
        groupKey = lead.sector || 'general';
      } else if (criteria.by_intent) {
        groupKey = lead.intent || 'unknown';
      }
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(lead);
    }
    return Object.entries(groups).map(([name, members]) => ({
      name,
      count: members.length,
      lead_ids: members.map(m => m.id),
      ai_generated: true,
      criteria,
    }));
  }

  mergeGroups(groupIds, newName) {
    const allMembers = new Set();
    for (const gid of groupIds) {
      const members = this.getMembers(gid);
      members.forEach(m => allMembers.add(m));
    }
    return this.createGroup({
      name: newName || `Merged: ${groupIds.join(' + ')}`,
      type: 'merged',
      member_ids: [...allMembers],
    });
  }

  getStats() {
    const total = this.groups.length;
    const manual = this.groups.filter(g => g.type === 'manual').length;
    const ai = this.groups.filter(g => g.type === 'ai_generated').length;
    const totalMembers = this.groups.reduce((sum, g) => sum + g.member_ids.length, 0);
    return { total_groups: total, manual, ai_generated: ai, total_members: totalMembers };
  }

  _loadGroups() {
    const file = path.join(GROUPS_DIR, 'groups.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    return [];
  }

  _saveGroups() {
    fs.writeFileSync(path.join(GROUPS_DIR, 'groups.json'), JSON.stringify(this.groups, null, 2));
  }
}

module.exports = { ContactGroups };
