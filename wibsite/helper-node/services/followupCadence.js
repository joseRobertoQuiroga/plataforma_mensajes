'use strict';
/**
 * followupCadence.js — Cadencia de seguimiento (G15-05, Oleada 6)
 *
 * Manages follow-up sequences with configurable delays, lost thresholds,
 * and automatic conversion to nurture mode.
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
 * Resolve placeholders in a message template
 */
function resolvePlaceholders(template, lead = {}) {
  let resolved = template;
  const vars = {
    name: lead.name || 'Cliente',
    phone: lead.phone || '',
    email: lead.email || '',
    score: lead.score || 0,
  };
  for (const [key, value] of Object.entries(vars)) {
    resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return resolved;
}

/**
 * V3: Get the next follow-up message for a lead based on cadence rules.
 * Returns { message, delay_days, message_type, should_send, reason }
 */
function getNextFollowup(lead, templateId = 'template-consultora-software', lastContactDate = null) {
  const template = loadTemplate(templateId);
  if (!template || !template.followup || !template.followup.sequence) {
    return { message: null, delay_days: 0, message_type: null, should_send: false, reason: 'no_template' };
  }

  const config = template.followup;
  const sequence = config.sequence;
  const lostThreshold = config.lost_threshold || 50;
  const businessHoursOnly = config.business_hours_only !== false;
  const timezone = config.timezone || 'UTC';

  // Check if lead is still viable (score > lost_threshold)
  const leadScore = lead.score || 0;
  if (leadScore < lostThreshold) {
    return {
      message: null,
      delay_days: 0,
      message_type: 'nurture',
      should_send: false,
      reason: `score_below_lost_threshold (${leadScore} < ${lostThreshold})`,
    };
  }

  // Determine how many days since last contact
  const lastContact = lastContactDate || lead.updated_at || lead.created_at;
  if (!lastContact) {
    // First contact — send immediate confirmation
    const first = sequence[0];
    return {
      message: resolvePlaceholders(first.message_template, lead),
      delay_days: 0,
      message_type: first.message_type,
      should_send: true,
      reason: 'first_contact',
    };
  }

  const daysSinceContact = Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000);

  // Find the appropriate step in the sequence
  let currentStep = 0;
  for (let i = 0; i < sequence.length; i++) {
    if (daysSinceContact >= sequence[i].delay_days) {
      currentStep = i;
    }
  }

  const step = sequence[currentStep];

  // Check business hours if required
  if (businessHoursOnly) {
    const now = new Date();
    // Convert to target timezone (simplified — uses UTC offset)
    const hour = now.getUTCHours();
    if (hour < 9 || hour >= 18) {
      return {
        message: resolvePlaceholders(step.message_template, lead),
        delay_days: step.delay_days,
        message_type: step.message_type,
        should_send: false,
        reason: 'outside_business_hours',
      };
    }
  }

  // If we've passed the last step, convert to nurture
  if (currentStep >= sequence.length - 1 && daysSinceContact >= sequence[sequence.length - 1].delay_days) {
    return {
      message: resolvePlaceholders(step.message_template, lead),
      delay_days: step.delay_days,
      message_type: 'nurture',
      should_send: true,
      reason: 'nurture_mode',
    };
  }

  // Calculate next send time
  const nextStep = Math.min(currentStep + 1, sequence.length - 1);
  const nextDelay = sequence[nextStep].delay_days;
  const daysUntilNext = Math.max(0, nextDelay - daysSinceContact);

  return {
    message: resolvePlaceholders(step.message_template, lead),
    delay_days: step.delay_days,
    message_type: step.message_type,
    should_send: daysSinceContact >= step.delay_days,
    reason: daysSinceContact >= step.delay_days ? 'due_for_send' : `wait_${daysUntilNext}_days`,
    next_step: nextStep,
    next_delay_days: nextDelay,
  };
}

/**
 * V3: Check if a follow-up should be sent based on cadence rules
 */
function shouldSendFollowup(lead, templateId = 'template-consultora-software', lastContactDate = null) {
  const result = getNextFollowup(lead, templateId, lastContactDate);
  return result.should_send;
}

module.exports = {
  getNextFollowup,
  shouldSendFollowup,
  resolvePlaceholders,
};
