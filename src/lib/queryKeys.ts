export const queryKeys = {
  dashboard: ['dashboard'] as const,
  demands: (filters?: object) => ['demands', filters] as const,
  candidates: (filters?: object) => ['candidates', filters] as const,
  candidateHistory: (candidateId: string) => ['candidates', candidateId, 'history'] as const,
  candidateConversations: (candidateId: string) => ['candidates', candidateId, 'conversations'] as const,
  interviews: (filters?: object) => ['interviews', filters] as const,
  offers: (filters?: object) => ['offers', filters] as const,
  onboardings: (filters?: object) => ['onboardings', filters] as const,
  performance: ['performance'] as const,
  users: (filters?: object) => ['users', filters] as const,
  currentUser: ['currentUser'] as const,
  logs: ['logs'] as const,
  clients: ['clients'] as const,
  settings: ['settings'] as const,
  dropdownOptions: (category: string) => ['settings', 'dropdown-options', category] as const,
  lifecycle: (requestId: string) => ['demands', requestId, 'lifecycle'] as const,
  demandAssignments: (requestId: string) => ['demands', requestId, 'assignments'] as const,
  demandStatusEvents: (requestId: string) => ['demands', requestId, 'status-events'] as const,
  demandCandidates: (requestId: string, filters?: object) => ['demands', requestId, 'candidates', filters] as const,
  demandCandidateDetail: (requestId: string, dcId: string) => ['demands', requestId, 'candidates', dcId] as const,
  demandInterviewConfig: (requestId: string) => ['demands', requestId, 'interview-config'] as const,
  demandRequestIdCheck: (requestId: string, excludeId?: string) => ['demands', 'request-id-check', requestId, excludeId] as const,
  demandOwnInterviewRounds: (requestId: string) => ['demands', requestId, 'own-interview-rounds'] as const,
  demandOnboarding: (requestId: string, dcId: string) => ['demands', requestId, 'candidates', dcId, 'onboarding'] as const,
  calendarInterviews: (filters?: object) => ['calendar', 'interviews', filters] as const,
  interviewFilterOptions: (type: string, search: string) => ['interviews', 'filter-options', type, search] as const,
  superAdminSettingsDF: ['admin', 'settings', 'demand-fulfillment'] as const,
  superAdminSettingsDFIncludeInactive: ['admin', 'settings', 'demand-fulfillment', 'include-inactive'] as const,
  candidateDemandHistory: (candidateId: string, excludeDemandId?: string) => ['candidates', candidateId, 'demand-history', excludeDemandId] as const,
  // "Add Existing Candidate" picker — one key per (demand, search term) so a new search
  // starts a fresh list instead of filtering the pages already loaded.
  demandCandidatePicker: (requestId: string, search: string) => ['candidates', 'picker', requestId, search] as const,
  // Notifications — the bell badge is a separate key so marking read only refreshes the count,
  // not the whole feed.
  //
  // `search` is part of the feed key: each term is its own server-side result set with its own
  // cursor chain, so results for a term the user has searched before are served from cache
  // instead of being refetched, and a term never inherits another term's pages. The default ''
  // keeps the unsearched feed on the historical key shape.
  notifications: (filter: string, search = '') => ['notifications', filter, search] as const,
  notificationsUnreadCount: ['notifications', 'unread-count'] as const,
  skillsLibrary: ['skills-library'] as const,
  skillsLibraryIncludeInactive: ['skills-library', 'include-inactive'] as const,
  compensationCurrencies: ['compensation-currencies'] as const,
  compensationCurrenciesIncludeInactive: ['compensation-currencies', 'include-inactive'] as const,
  compensationTypes: ['compensation-types'] as const,
  compensationTypesIncludeInactive: ['compensation-types', 'include-inactive'] as const,
  masterData: (kind: string) => ['master-data', kind] as const,
  masterDataIncludeInactive: (kind: string) => ['master-data', kind, 'include-inactive'] as const,
  endClients: (filters?: object) => ['end-clients', filters] as const,
  endClientsActive: ['end-clients', 'active'] as const,
  /** A client's SPOCs for the demand form's Select/Add SPOC field. Under 'companies' so a
   *  Clients Master save (which invalidates ['companies']) refreshes it too. */
  companySpocs: (companyId: string) => ['companies', companyId, 'spocs'] as const,
  /** Skill Group ids linked to each Demand Type (Master Data → Demand Type). */
  demandTypeSkillGroups: ['master-data', 'demand-types', 'skill-groups'] as const,
  demandChangeLog: (requestId: string) => ['demands', requestId, 'change-log'] as const,
  demandCallLogs: (requestId: string) => ['demands', requestId, 'call-logs'] as const,
  demandInstructions: (requestId: string) => ['demands', requestId, 'instructions'] as const,
  taskLogs: (filters?: object) => ['task-logs', filters] as const,
  reportClientPhases: (companyId: string | null, includeClosed: boolean) => ['reports', 'client-phases', companyId, includeClosed] as const,
  reportTodaysInterviews: (date: string | null) => ['reports', 'todays-interviews', date] as const,
  reportReadyToJoin: (skillGroup: string | null, location: string | null) => ['reports', 'ready-to-join', skillGroup, location] as const,
  todos: (view: string, page?: number) => ['todos', view, page] as const,
  onboardingSteps: (onboardingId: string) => ['onboardings', onboardingId, 'steps'] as const,
  onboardingStepTemplates: (companyId: string) => ['onboarding-step-templates', companyId] as const,
};
