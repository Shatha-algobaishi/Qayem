// ── Auth ──────────────────────────────────────────────────────
export interface RoleOption {
  roleName: string;
  roleNameAr: string;
}

export interface UserDto {
  isDemo?: boolean;
  demoWriteEnabled?: boolean;
  id: string;
  fullNameAr: string;
  fullNameEn: string;
  email: string;
  username: string;
  roleName: 'Admin' | 'DataEntry' | 'Evaluator' | 'Manager';
  roleNameAr: string;
  additionalRoles?: RoleOption[];
  department?: string;
  jobTitle?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  activeRoleName: string | null;
}

// ── Sessions ──────────────────────────────────────────────────
export type SessionStatus = 'Draft' | 'Active' | 'Closed' | 'Archived';

export interface SessionSummary {
  id: string;
  sessionCode: string;
  titleAr: string;
  titleEn: string;
  jobPositionAr: string;
  department: string;
  scheduledDate?: string | null;
  location?: string;
  status: SessionStatus;
  candidateCount: number;
  evaluatorCount: number;
  createdAt: string;
}

export interface SessionDetail extends SessionSummary {
  titleEn: string;
  jobPositionEn: string;
  notes?: string;
  closedAt?: string;
  evaluators: EvaluatorDto[];
}

export interface EvaluatorDto {
  userId: string;
  fullNameAr: string;
  fullNameEn: string;
  email: string;
  assignedAt: string;
}

// ── Candidates ────────────────────────────────────────────────
export type CandidateStatus = 'Pending' | 'InProgress' | 'Completed';
export type DecisionType    = 'NotQualified' | 'ConditionallyQualified' | 'Recommended' | 'Employed';

export interface Candidate {
  id: string;
  sessionId: string;
  nationalId: string;
  fullNameAr: string;
  fullNameEn: string;
  email?: string;
  phoneNumber?: string;
  qualification?: string;
  specializationAr?: string;
  specializationEn?: string;
  yearsOfExperience?: number;
  applicationType?: string;
  gpa?: number;
  gpaSystem?: string;
  university?: string;
  currentEmployer?: string;
  currentTitle?: string;
  interviewScheduledAt?: string;
  interviewLocation?: string;
  candidateStatus: CandidateStatus;
  aggregateScore?: number;
  highestScore?: number;
  lowestScore?: number;
  scoreVariance?: number;
  hasDiscrepancy: boolean;
  systemDecision?: DecisionType;
  finalDecision?: DecisionType;
  isOverridden: boolean;
  aiSummary?: string;
  registeredAt: string;
  hasCv?: boolean;
  cvOriginalName?: string;
}

// ── Evaluations ───────────────────────────────────────────────
export type EvaluationStatus = 'Draft' | 'Submitted' | 'ReviewedByManager';

export interface Question {
  id: string;
  textAr: string;
  textEn: string;
  category?: string;
  orderIndex: number;
  maxScore: number;
  isActive: boolean;
}

export interface AnswerDto {
  questionId: string;
  questionTextAr: string;
  questionTextEn: string;
  questionOrder: number;
  score: number;
  comment?: string;
}

export interface EvaluationDto {
  id: string;
  candidateId: string;
  candidateNameAr: string;
  candidateNameEn: string;
  evaluatorId: string;
  evaluatorNameAr: string;
  totalScore?: number;
  systemDecision?: DecisionType;
  status: EvaluationStatus;
  notes?: string;
  aiSummary?: string;
  submittedAt?: string;
  answers: AnswerDto[];
}

export interface CandidateEvaluationSummary {
  candidateId: string;
  fullNameAr: string;
  fullNameEn: string;
  nationalId: string;
  averageScore?: number;
  highestScore?: number;
  lowestScore?: number;
  variance?: number;
  hasDiscrepancy: boolean;
  systemDecision?: DecisionType;
  finalDecision?: DecisionType;
  isOverridden: boolean;
  overrideReason?: string;
  aiSummary?: string;
  submittedEvaluations: number;
  totalAssignedEvaluators: number;
  evaluations: EvaluationDto[];
}

// ── Session Comparison (ranking engine) ───────────────────────
export interface EvaluatorScoreDto {
  evaluatorId: string;
  evaluatorNameAr: string;
  score?: number;
}

export interface CandidateRankingDto {
  rank: number;
  candidateId: string;
  fullNameAr: string;
  fullNameEn: string;
  nationalId: string;
  averageScore?: number;
  highestScore?: number;
  lowestScore?: number;
  variance?: number;
  hasDiscrepancy: boolean;
  systemDecision?: DecisionType;
  finalDecision?: DecisionType;
  isOverridden: boolean;
  overrideReason?: string;
  submittedEvaluations: number;
  totalEvaluators: number;
  aiSummary?: string;
  evaluatorScores: EvaluatorScoreDto[];
}

export interface SessionComparisonDto {
  sessionId: string;
  sessionCode: string;
  titleAr: string;
  titleEn: string;
  totalCandidates: number;
  evaluatedCandidates: number;
  hasAnyDiscrepancy: boolean;
  discrepancyThreshold: number;
  notQualifiedThreshold: number;
  conditionalThreshold: number;
  rankings: CandidateRankingDto[];
}

// ── Manager dashboard ─────────────────────────────────────────
export interface TopCandidateDto {
  id: string;
  fullNameAr: string;
  fullNameEn: string;
  aggregateScore?: number;
  finalDecision?: string;
  jobPositionAr?: string;
}

export interface ManagerDashboard {
  totalSessions: number;
  totalActiveSessions: number;
  totalCandidates: number;
  totalApplicants: number;
  employedCount: number;
  recommendedCount: number;
  conditionalCount: number;
  notQualifiedCount: number;
  recentSessions: SessionSummaryForManager[];
  topCandidates: TopCandidateDto[];
  bottomCandidates: TopCandidateDto[];
}

export interface SessionSummaryForManager {
  sessionId: string;
  sessionCode: string;
  titleAr: string;
  totalCandidates: number;
  pendingDecisions: number;
  completedDecisions: number;
  scheduledDate?: string | null;
  hasDiscrepancy: boolean;
}

// ── Evaluator analytics ───────────────────────────────────────
export interface EvaluatorAnalyticsDto {
  evaluatorId: string;
  fullNameAr: string;
  fullNameEn: string;
  totalEvaluations: number;
  averageScoreGiven: number;
  minScoreGiven: number;
  maxScoreGiven: number;
  stdDeviation: number;
  meanDeviation: number;
  biasLabel: 'PositiveBias' | 'NegativeBias' | 'StandardConsistency';
}

// ── System settings ───────────────────────────────────────────
export interface SystemSettingDto {
  id: string;
  key: string;
  value: string;
  description?: string;
  descriptionAr?: string;
  dataType: 'string' | 'int' | 'decimal' | 'bool';
}

// ── Notifications ─────────────────────────────────────────────
export interface NotificationDto {
  id: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  type: string;
  isRead: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: string;
}

// ── Shared ────────────────────────────────────────────────────
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  status: number;
  title: string;
  detail: string;
  traceId?: string;
}
