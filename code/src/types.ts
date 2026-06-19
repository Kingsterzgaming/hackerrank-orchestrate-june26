/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Claim {
  user_id: string;
  image_paths: string;
  user_claim: string;
  claim_object: 'car' | 'laptop' | 'package';
}

export interface UserHistory {
  user_id: string;
  past_claim_count: number;
  accept_claim: number;
  manual_review_claim: number;
  rejected_claim: number;
  last_90_days_claim_count: number;
  history_flags: string;
  history_summary: string;
}

export interface EvidenceRequirement {
  requirement_id: string;
  claim_object: 'car' | 'laptop' | 'package' | 'all';
  applies_to: string;
  minimum_image_evidence: string;
}

export interface ClaimResult {
  user_id: string;
  image_paths: string;
  user_claim: string;
  claim_object: 'car' | 'laptop' | 'package';
  evidence_standard_met: string; // 'true' | 'false'
  evidence_standard_met_reason: string;
  risk_flags: string;
  issue_type: string;
  object_part: string;
  claim_status: 'supported' | 'contradicted' | 'not_enough_information';
  claim_status_justification: string;
  supporting_image_ids: string;
  valid_image: string; // 'true' | 'false'
  severity: 'none' | 'low' | 'medium' | 'high' | 'unknown';
}

export interface PerformanceMetrics {
  totalClaims: number;
  evidenceMetCount: number;
  supportedCount: number;
  contradictedCount: number;
  insufficientInfoCount: number;
  riskFlaggedCount: number;
  byObject: Record<string, { total: number; supported: number }>;
  accuracy?: number; // matched with sample claims if evaluated
  latencyMs?: number;
}
