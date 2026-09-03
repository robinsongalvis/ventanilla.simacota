import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  esNumeroLegal,
  esSerieDeEntrada,
  numeroDeEntrada,
  rotuloDeSerie,
} from '@/lib/motor-expedientes/numeros-del-expediente';
import { CabeceraExpediente } from '@/app/interno/licencias/components/CabeceraExpediente';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

/* ══════════════════════════════════════════════════════════════
   LOS DOS NÚMEROS DEL EXPEDIENTE — custodio del paso 1 del ADR-0041
   (1-sep-2026).

   El ADR separa lo que hoy es un solo objeto: el `1-110-…` de ENTRADA (el que
   tiene el ciudadano y ancla el término) y el `68745-…` del EXPEDIENTE (la
   serie de Planeación). Este paso no separa nada todavía: pone a cada
   superficie a pedir el número POR SU SIGNIFICADO, de modo que con los datos
   de hoy todo dé exactamente igual y el día del cambio nadie quede pidiendo el
   equivocado.

   POR QUÉ ESTE CUSTODIO EXISTE. Sin él, «pedir por significado» es una
   convención de comentarios: cualquiera puede volver a leer `numeroExpediente`
   a secas y el papel saldría diciendo «RECIBIDO POR VENTANILLA ÚNICA
   68745-0-26-0021» — un número de licencia bajo el rótulo de ventanilla.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA:
     · que `numeroDeEntrada` prefiera el vínculo y NO devuelva un número de la
       serie de expedientes disfrazado de radicado;
     · que `esNumeroLegal` diga que no al número AUSENTE (el agujero que el
       corte por prefijo «DEMO-» no veía) y a las series de ensayo;
     · que el rótulo salga de la SERIE, probado sobre la cabecera REAL
       renderizada — no sobre la función suelta.
   Esto NO mira: el cableado de las rutas de sello y constancia (una línea cada
   una, visible en el diff de esta misma PR), ni la emisión del 68745, que
   todavía no existe (paso 4).
══════════════════════════════════════════════════════════════ */

describe('numeroDeEntrada — el número que el ciudadano tiene en la mano', () => {
  it('manda el ESPEJO — lo escribe el acto de radicar, y existe también sin vínculo', () => {
    /* Paso 4 del ADR-0041: el expediente sin vínculo digital obtiene su 1-110
       por transcripción del libro, y sin el espejo no tendría dónde vivir. */
    expect(numeroDeEntrada({
      numeroRadicadoEntrada: '1-110-202609-00000041',
      radicadoId: null,
      numeroExpediente: { numero: '68745-0-26-0021', serieId: 'expedientes' },
    })).toBe('1-110-202609-00000041');
  });

  it('con vínculo, manda el vínculo: ese id ES el 1-110', () => {
    expect(numeroDeEntrada({
      radicadoId: '1-110-202609-00000041',
      numeroExpediente: { numero: '68745-0-26-0021', serieId: 'expedientes' },
    })).toBe('1-110-202609-00000041');
  });

  it('sin vínculo pero con número de VENTANILLA en el campo del expediente, lo devuelve', () => {
    /* El estado que dejó el pivote del 26-ago: `numeroExpediente` cargando un
       1-110. Es el caso que hace de este paso un no-op. */
    expect(numeroDeEntrada({
      radicadoId: null,
      numeroExpediente: { numero: '1-110-202608-00000040', serieId: 'radicados' },
    })).toBe('1-110-202608-00000040');
  });

  it('sin vínculo y con número de EXPEDIENTE, devuelve null — jamás lo hace pasar por radicado', () => {
    /* La razón de ser del módulo: si esto devolviera el 68745, el sello lo
       estamparía bajo «RECIBIDO POR VENTANILLA ÚNICA» y el papel mentiría
       sobre qué oficina emitió ese número. */
    expect(numeroDeEntrada({
      radicadoId: null,
      numeroExpediente: { numero: '68745-0-26-0021', serieId: 'expedientes' },
    })).toBeNull();
  });

  it('el histórico importado tampoco pasa por radicado', () => {
    expect(numeroDeEntrada({
      radicadoId: null,
      numeroExpediente: { numero: '68745-0-25-0037', serieId: 'historico-consecutivo-planeacion' },
    })).toBeNull();
  });

  it('solo la serie de ventanilla es serie de entrada', () => {
    expect(esSerieDeEntrada('radicados')).toBe(true);
    for (const otra of ['expedientes', 'demo', 'e2e-stage', 'historico-consecutivo-planeacion', undefined]) {
      expect(esSerieDeEntrada(otra), `«${otra}» no emite radicados de ventanilla`).toBe(false);
    }
  });
});

describe('esNumeroLegal — lo que se le puede decir a un ciudadano', () => {
  it('AUSENTE no es legal — el agujero que el corte por prefijo no veía', () => {
    /* El defecto exacto: el gate de comunicaciones cortaba con
       `numero.startsWith('DEMO-')`. Cuando el expediente pase a nacer SIN
       número (paso 3), un ausente no empieza por «DEMO-» y el correo habría
       salido diciendo «Expediente undefined» a una persona real. */
    expect(esNumeroLegal(undefined)).toBe(false);
    expect(esNumeroLegal(null)).toBe(false);
    expect(esNumeroLegal({ numero: '', serieId: 'expedientes' })).toBe(false);
  });

  it('demostración y ensayo tampoco: nadie podría encontrar el trámite con ellos', () => {
    expect(esNumeroLegal({ numero: 'DEMO-26-a1b2c3d4', serieId: 'demo' })).toBe(false);
    expect(esNumeroLegal({ numero: '68745-0-26-0001', serieId: 'e2e-stage' })).toBe(false);
  });

  it('las series reales sí — las tres que hoy existen en documentos', () => {
    expect(esNumeroLegal({ numero: '1-110-202609-00000041', serieId: 'radicados' })).toBe(true);
    expect(esNumeroLegal({ numero: '68745-0-26-0021', serieId: 'expedientes' })).toBe(true);
    expect(esNumeroLegal({ numero: '68745-0-25-0037', serieId: 'historico-consecutivo-planeacion' })).toBe(true);
  });
});

describe('rotuloDeSerie — el rótulo sale de la serie, en la cabecera REAL', () => {
  function expedienteCon(numeroExpediente: { numero: string; serieId: string }): ExpedienteLicenciaDoc {
    return {
      id: 'exp-1',
      tenantId: 'SEC_PLANEACION',
      tramiteId: 'licencia-construccion-obra-nueva',
      solicitanteNombre: 'Andrés Pérez',
      solicitanteDocumento: '123446432',
      estadoJuridico: 'PRESENTADA',
      subtipos: ['CONSTRUCCION'],
      numeroExpediente,
    } as unknown as ExpedienteLicenciaDoc;
  }

  /** El rótulo PEGADO a su número — no «aparece la palabra en la pantalla»,
      que es lo que hace verde a una prueba por el motivo equivocado. */
  function rotuloJuntoAlNumero(numero: string): string {
    const nodo = screen.getByText(numero);
    return (nodo.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('un número de VENTANILLA se rotula «Radicado» — lo de siempre, sin cambio visible', () => {
    render(
      <CabeceraExpediente
        expediente={expedienteCon({ numero: '1-110-202608-00000040', serieId: 'radicados' })}
        desdeCuandoCorreElPlazo={null}
      />,
    );
    expect(rotuloJuntoAlNumero('1-110-202608-00000040')).toBe('Radicado 1-110-202608-00000040');
  });

  it('un número de la serie de PLANEACIÓN se rotula «Expediente», en la misma pantalla', () => {
    /* Sin reescribir un solo documento: el significado lo declara el
       `serieId` de cada uno (AGN 060 — no se renumera). */
    render(
      <CabeceraExpediente
        expediente={expedienteCon({ numero: '68745-0-26-0021', serieId: 'expedientes' })}
        desdeCuandoCorreElPlazo={null}
      />,
    );
    expect(rotuloJuntoAlNumero('68745-0-26-0021')).toBe('Expediente 68745-0-26-0021');
  });

  it('una serie desconocida se rotula neutro — no se le inventa identidad', () => {
    expect(rotuloDeSerie('serie-que-nadie-ha-escrito')).toBe('Número');
    expect(rotuloDeSerie(undefined)).toBe('Número');
  });
});
