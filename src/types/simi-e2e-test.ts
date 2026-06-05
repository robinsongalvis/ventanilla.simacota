export type E2ETestMode = 'dry_run' | 'commit_test';
export type E2ETestRunStatus = 'running' | 'success' | 'failed' | 'partial' | 'archived';
export type E2ETestStepStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface E2ETestStep {
  nombre: string;
  estado: E2ETestStepStatus;
  detalle?: string;
  entidadCreadaId?: string;
  error?: string;
  fecha: string;
}

export interface E2ETestSummary {
  totalPasos: number;
  exitosos: number;
  fallidos: number;
  omitidos: number;
}

export interface E2ETestRun {
  id?: string;
  testRunId: string;
  tenantId: string;
  ejecutadoPor: string;
  rol: string;
  fechaInicio: string;
  fechaFin?: string;
  estado: E2ETestRunStatus;
  pasos: E2ETestStep[];
  resumen: E2ETestSummary;
  createdAt: string;
  updatedAt: string;
}

export interface E2ETestRequest {
  modo: E2ETestMode;
  emailTest?: boolean;
  whatsappMock?: boolean;
  incluirPdf?: boolean;
  incluirConsultaCiudadana?: boolean;
}

export interface E2ETestResponse {
  ok: boolean;
  testRunId: string;
  modo: E2ETestMode;
  estado: E2ETestRunStatus;
  pasos: E2ETestStep[];
  resumen: E2ETestSummary;
  entidades: {
    radicadoId?: string;
    approvalId?: string;
    borradorVersionId?: string;
    firmaId?: string;
    pdfUrl?: string;
    consultaUrl?: string;
  };
  tiempoMs: number;
}
