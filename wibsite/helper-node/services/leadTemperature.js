'use strict';
/**
 * leadTemperature.js — Temperatura del lead 3D (G15-04, Oleada 6)
 *
 * Calculates lead temperature from 3 dimensions:
 * - fit (30%): How well the lead matches the ideal profile
 * - engagement (40%): Activity level and recency
 * - intent (30%): Explicit signals of purchase intent
 *
 * Thresholds: hot=70, warm=40, cold<40
 * Decay: -20% every N days without interaction
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function loadTemplate(templateId) {
  const filePath = path.join(TEMPLATES_DIR, `${templateId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * V2: Calculate lead temperature from 3 dimensions.
 * Returns { score, category, dimensions: { fit, engagement, intent }, decay_applied, reason }
 */
function calculateTemperature(lead, templateId = 'template-consultora-software', deliveryHistory = []) {
  const template = loadTemplate(templateId);
  const thresholds = template?.lead_temperature || { hot_threshold: 70, warm_threshold: 40, decay_percentage: 20, decay_days: 5 };

  // Dimension 1: Fit (30%) — how well lead matches ideal profile
  const fitScore = calculateFit(lead);

  // Dimension 2: Engagement (40%) — activity level and recency
  const engagementScore = calculateEngagement(lead, deliveryHistory);

  // Dimension 3: Intent (30%) — explicit signals
  const intentScore = calculateIntent(lead);

  // Weighted average
  const rawScore = Math.round(fitScore * 0.3 + engagementScore * 0.4 + intentScore * 0.3);

  // Apply decay if no recent activity
  const lastActivity = lead.updated_at || lead.created_at;
  const daysSinceActivity = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000) : 999;
  let decayApplied = 0;
  let finalScore = rawScore;

  if (daysSinceActivity > thresholds.decay_days) {
    const decayPeriods = Math.floor((daysSinceActivity - thresholds.decay_days) / thresholds.decay_days);
    decayApplied = Math.min(rawScore, decayPeriods * (thresholds.decay_percentage || 20));
    finalScore = Math.max(0, rawScore - decayApplied);
  }

  // Determine category
  let category = 'cold';
  if (finalScore >= thresholds.hot_threshold) category = 'hot';
  else if (finalScore >= thresholds.warm_threshold) category = 'warm';

  return {
    score: finalScore,
    category,
    dimensions: {
      fit: fitScore,
      engagement: engagementScore,
      intent: intentScore,
    },
    decay_applied: decayApplied,
    reason: decayApplied > 0 ? `Decay ${decayApplied}pts por ${daysSinceActivity}d sin actividad` : 'Sin decay',
  };
}

/**
 * Calculate fit score (0-100) based on lead profile completeness and match
 */
function calculateFit(lead) {
  let score = 0;
  // Basic data completeness (up to 40 points)
  if (lead.name) score += 10;
  if (lead.phone) score += 10;
  if (lead.email) score += 10;
  if (lead.custom_fields?.company || lead.custom_fields?.business_type) score += 10;

  // Interest match (up to 30 points)
  const interests = lead.custom_fields?.interest || '';
  if (interests) score += 15;
  if (interests && (interests.includes('software') || interests.includes('desarrollo') || interests.includes('integracion'))) {
    score += 15;
  }

  // Budget signals (up to 30 points)
  const budget = lead.custom_fields?.budget || 0;
  if (budget >= 10000) score += 30;
  else if (budget >= 5000) score += 20;
  else if (budget >= 1000) score += 10;

  return Math.min(100, score);
}

/**
 * Calculate engagement score (0-100) based on activity and recency
 */
function calculateEngagement(lead, deliveryHistory = []) {
  let score = 0;
  const now = Date.now();

  // Message count (up to 30 points)
  const messageCount = deliveryHistory.filter(d => d.direction === 'inbound' || d.status === 'replied').length;
  score += Math.min(30, messageCount * 10);

  // Recency of last reply (up to 40 points)
  const lastReply = deliveryHistory
    .filter(d => d.status === 'replied' || d.direction === 'inbound')
    .sort((a, b) => new Date(b.sent_at || b.created_at) - new Date(a.sent_at || a.created_at))[0];

  if (lastReply) {
    const daysSinceReply = Math.floor((now - new Date(lastReply.sent_at || lastReply.created_at).getTime()) / 86400000);
    if (daysSinceReply <= 1) score += 40;
    else if (daysSinceReply <= 3) score += 30;
    else if (daysSinceReply <= 7) score += 20;
    else if (daysSinceReply <= 14) score += 10;
  }

  // Score history trend (up to 30 points)
  const scoreHistory = lead.score_history || [];
  if (scoreHistory.length >= 2) {
    const recent = scoreHistory.slice(-3);
    const trend = recent[recent.length - 1].score - recent[0].score;
    if (trend > 0) score += Math.min(30, trend);
  }

  return Math.min(100, score);
}

/**
 * Calculate intent score (0-100) based on explicit signals
 */
function calculateIntent(lead) {
  let score = 0;
  const custom = lead.custom_fields || {};

  // Explicit intent signals
  if (custom.intent === 'comprar' || custom.intent === 'cotizar') score += 40;
  else if (custom.intent === 'informacion') score += 20;

  // Urgency signals
  if (custom.urgency === 'alta') score += 30;
  else if (custom.urgency === 'media') score += 15;

  // Has requested specific info
  if (custom.service_type) score += 15;
  if (custom.timeline) score += 15;

  return Math.min(100, score);
}

module.exports = {
  calculateTemperature,
  calculateFit,
  calculateEngagement,
  calculateIntent,
};
