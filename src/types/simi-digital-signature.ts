export type DigitalSignatureStatus =
  | 'no_requerida'
  | 'pendiente'
  | 'enviada_a_proveedor'
  | 'firmada'
  | 'rechazada'
  | 'error';

export interface DigitalSignatureCertificateInfo {
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  algorithm?: string;
}

export interface DigitalSignatureRequest {
  firmaId: string;
  radicadoId: string;
  tenantId: string;
  documentoHash: string;
  documentoUrl?: string;
  firmanteNombre: string;
  firmanteCargo?: string;
}

export interface DigitalSignatureResult {
  status: DigitalSignatureStatus;
  provider?: string;
  requestId?: string;
  signedAt?: string;
  signedDocumentUrl?: string;
  certificateInfo?: DigitalSignatureCertificateInfo;
  error?: string;
}
