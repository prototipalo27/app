// Texto del acuerdo de confidencialidad de Prototipalo. Una sola fuente
// de verdad — la consume tanto la página /nda/[token] (HTML preview)
// como `nda-pdf.ts` (PDF firmado). Si cambias algo aquí, ambas
// representaciones se actualizan a la vez.

export const COMPANY_NAME = "PROTOTIPALO S.L.";
export const COMPANY_ADDRESS = "Calle Viriato 27, 28010 Madrid";
export const COMPANY_NIF = "B72410665";
export const COMPANY_REPRESENTATIVE = "Manuel de la Viña";

export interface NdaSignerData {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
}

/** Frase de "REUNIDOS" para LA EMPRESA — siempre la misma. */
export const REUNIDOS_EMPRESA = `De una parte, ${COMPANY_NAME}, con domicilio en ${COMPANY_ADDRESS}, y CIF ${COMPANY_NIF}, representada por ${COMPANY_REPRESENTATIVE} (en adelante, "LA EMPRESA").`;

/**
 * Frase de "REUNIDOS" para LA PARTE RECEPTORA con los datos del firmante.
 * Si pasas null/datos vacíos, devuelve la versión con placeholders para
 * mostrar como preview antes de que el cliente rellene el formulario.
 */
export function reunidosReceptor(data: NdaSignerData | null): string {
  const company = data?.signerCompany?.trim() || data?.signerName?.trim() || "[Nombre o empresa firmante]";
  const address = data?.signerAddress?.trim() || "[Dirección del firmante]";
  const nif = data?.signerNif?.trim() || "[NIF/CIF del firmante]";
  const repr = data?.signerName?.trim() || "[Nombre del firmante]";
  return `De otra parte, ${company}, con domicilio en ${address}, y NIF/CIF ${nif}, representada por ${repr} (en adelante, "LA PARTE RECEPTORA").`;
}

export const EXPONEN_TEXT =
  "Que ambas partes desean iniciar o continuar una relación comercial que puede implicar el intercambio de información confidencial, incluyendo pero no limitándose a: diseños, planos, modelos 3D, prototipos, procesos de fabricación, estrategias comerciales, datos de clientes y cualquier otra información de carácter reservado.";

/** Cláusulas numeradas del acuerdo. [título, cuerpo]. */
export const NDA_CLAUSES: [string, string][] = [
  [
    "Definición de información confidencial.",
    "Se considera información confidencial toda aquella información, ya sea oral, escrita, gráfica, electrónica o en cualquier otro soporte, que una parte revele a la otra en el marco de la relación comercial, incluyendo diseños, archivos 3D, especificaciones técnicas, precios, plazos y cualquier dato relativo a proyectos en curso.",
  ],
  [
    "Obligación de confidencialidad.",
    "La parte receptora se compromete a mantener en estricta confidencialidad toda la información recibida, no divulgarla a terceros sin consentimiento previo por escrito de la parte reveladora, y utilizarla únicamente para los fines de la relación comercial entre ambas partes.",
  ],
  [
    "Medidas de protección.",
    "La parte receptora adoptará las medidas de seguridad razonables para proteger la información confidencial, con al menos el mismo grado de protección que aplica a su propia información confidencial.",
  ],
  [
    "Exclusiones.",
    "No se considerará confidencial la información que: (a) sea de dominio público sin culpa de la parte receptora; (b) haya sido recibida legítimamente de un tercero sin restricciones; (c) haya sido desarrollada independientemente por la parte receptora.",
  ],
  [
    "Duración.",
    "Las obligaciones de confidencialidad establecidas en este acuerdo permanecerán vigentes durante un plazo de 2 (dos) años a partir de la fecha de firma, incluso tras la finalización de la relación comercial entre las partes.",
  ],
  [
    "Devolución de información.",
    "A la terminación de la relación comercial o cuando lo solicite la parte reveladora, la parte receptora devolverá o destruirá toda la información confidencial recibida y cualquier copia de la misma.",
  ],
  [
    "Legislación aplicable.",
    "Este acuerdo se regirá por la legislación española. Para cualquier controversia derivada del mismo, las partes se someten a los juzgados y tribunales de Madrid.",
  ],
];

export const CLOSING_TEXT = "Y en prueba de conformidad, las partes firman el presente acuerdo:";
