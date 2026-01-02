export interface ClaimExtraction {
  incident_type: string;
  incident_date: string;
  location: string;
  involved_parties: string[];
  damage_description: string;
  estimated_cost?: string;
  key_topics: string[];
}

export interface VerificationResult {
  is_eligible: boolean;
  policy_matched?: string;
  reasoning: string;
  suggested_policy?: string;
  confidence_score: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface PolicyDocument {
  id: string;
  name: string;
  type: 'text' | 'file';
  content: string; // Base64 for file, text for text
  mimeType: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  EXTRACTING = 'EXTRACTING',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}