import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type {
  DigitalSignatureRequest,
  DigitalSignatureResult,
} from '@/src/types/simi-digital-signature';

const PROVIDER = process.env.DIGITAL_SIGNATURE_PROVIDER ?? '';

async function audit(
  action: string,
  request: Pick<DigitalSignatureRequest, 'firmaId' | 'radicadoId' | 'tenantId'>,
  result: DigitalSignatureResult,
) {
  await getFirebaseAdminDb().collection('simi_operational_auditoria').add({
    accion: action,
    resultado: result.status === 'error' ? 'error' : 'ok',
    firmaId: request.firmaId,
    radicadoId: request.radicadoId,
    tenantId: request.tenantId,
    provider: result.provider ?? (PROVIDER || null),
    requestId: result.requestId ?? null,
    error: result.error ?? null,
    fecha: new Date().toISOString(),
  }).catch(() => null);
}

export async function createDigitalSignatureRequest(
  request: DigitalSignatureRequest,
): Promise<DigitalSignatureResult> {
  if (!PROVIDER) {
    const result: DigitalSignatureResult = {
      status: 'no_requerida',
      error: 'Proveedor de firma digital certificada no configurado.',
    };
    await audit('FIRMA_DIGITAL_NO_CONFIGURADA', request, result);
    return result;
  }

  const result: DigitalSignatureResult = {
    status: 'pendiente',
    provider: PROVIDER,
    requestId: `pending_${request.firmaId}_${Date.now()}`,
  };
  await audit('FIRMA_DIGITAL_SOLICITADA', request, result);
  return result;
}

export async function checkDigitalSignatureStatus(params: {
  firmaId: string;
  radicadoId: string;
  tenantId: string;
  requestId?: string;
}): Promise<DigitalSignatureResult> {
  const result: DigitalSignatureResult = {
    status: PROVIDER ? 'pendiente' : 'no_requerida',
    provider: PROVIDER || undefined,
    requestId: params.requestId,
  };
  await audit('FIRMA_DIGITAL_ESTADO_CONSULTADO', params, result);
  return result;
}

export async function attachSignedDocument(params: {
  firmaId: string;
  radicadoId: string;
  tenantId: string;
  signedDocumentUrl: string;
}): Promise<DigitalSignatureResult> {
  const result: DigitalSignatureResult = {
    status: 'firmada',
    provider: PROVIDER || undefined,
    signedAt: new Date().toISOString(),
    signedDocumentUrl: params.signedDocumentUrl,
  };
  await audit('FIRMA_DIGITAL_DOCUMENTO_ADJUNTADO', params, result);
  return result;
}

export async function cancelDigitalSignatureRequest(params: {
  firmaId: string;
  radicadoId: string;
  tenantId: string;
  requestId?: string;
}): Promise<DigitalSignatureResult> {
  const result: DigitalSignatureResult = {
    status: 'rechazada',
    provider: PROVIDER || undefined,
    requestId: params.requestId,
  };
  await audit('FIRMA_DIGITAL_CANCELADA', params, result);
  return result;
}
