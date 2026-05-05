// Development & Collaboration Agreement template for Studio projects.
// Bilingual (ES / EN). Shared between the HTML preview (`/contract/[token]`)
// and the PDF generator (`studio-dev-agreement-pdf.ts`).
//
// The commercial terms (workspace fee, hourly rates, hour bags, minimum
// months, approval threshold) are passed in as a snapshot — they live on
// `studio_projects` as editable defaults and are frozen on the agreement
// row when the manager hits "send".

import {
  PROTOTIPALO_LEGAL_NAME,
  PROTOTIPALO_ADDRESS,
  PROTOTIPALO_NIF,
  PROTOTIPALO_REPRESENTATIVE_NAME,
  PROTOTIPALO_REPRESENTATIVE_POSITION,
} from "./studio-nda-text";

export type AgreementLanguage = "es" | "en";

export interface DevAgreementSigner {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signerPosition?: string;
}

export interface CommercialTerms {
  workspaceFee: number;
  engineeringHours: number;
  engineeringRate: number;
  printingHours: number;
  printingRate: number;
  minimumMonths: number;
  approvalThreshold: number;
}

export interface DevAgreementContext {
  language: AgreementLanguage;
  terms: CommercialTerms;
  /** Effective date — null on the preview screen before signing. */
  effectiveDate?: Date | null;
  /** Date the NDA was signed (Recital III) — null if no NDA on file. */
  ndaReferenceDate?: Date | null;
  /** Free-form project description (Recital II), reused from `nda_project_description`. */
  projectDescription?: string | null;
  signer?: DevAgreementSigner | null;
}

// ── Number formatting ──────────────────────────────────────────────

function fmtEur(value: number, lang: AgreementLanguage): string {
  return value.toLocaleString(lang === "es" ? "es-ES" : "en-IE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function spellNumber(n: number, lang: AgreementLanguage): string {
  // Solo cubrimos los enteros pequeños que aparecen en el contrato.
  const es: Record<number, string> = {
    1: "una", 2: "dos", 3: "tres", 5: "cinco", 15: "quince", 30: "treinta",
    50: "cincuenta", 250: "doscientos cincuenta", 300: "trescientos",
    3000: "tres mil", 60: "sesenta",
  };
  const en: Record<number, string> = {
    1: "one", 2: "two", 3: "three", 5: "five", 15: "fifteen", 30: "thirty",
    50: "fifty", 250: "two hundred and fifty", 300: "three hundred",
    3000: "three thousand", 60: "sixty",
  };
  return (lang === "es" ? es : en)[n] ?? String(n);
}

function placeholder(value: string | null | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

export function formatEffectiveDate(d: Date | null | undefined, lang: AgreementLanguage): string {
  if (!d) return lang === "es" ? "[FECHA DE EFECTIVIDAD]" : "[EFFECTIVE DATE]";
  return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

export function formatNdaDate(d: Date | null | undefined, lang: AgreementLanguage): string {
  if (!d) return lang === "es" ? "[FECHA DEL NDA]" : "[NDA DATE]";
  return d.toLocaleDateString(lang === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

// ── Document chrome ────────────────────────────────────────────────

export function getTitle(lang: AgreementLanguage): string {
  return lang === "es"
    ? "CONTRATO DE DESARROLLO Y COLABORACIÓN"
    : "DEVELOPMENT AND COLLABORATION AGREEMENT";
}

export function getEffectiveDateParagraph(ctx: DevAgreementContext): string {
  const date = formatEffectiveDate(ctx.effectiveDate, ctx.language);
  if (ctx.language === "es") {
    return `El presente Contrato de Desarrollo y Colaboración (el «Contrato») se celebra y entra en vigor el ${date} (la «Fecha de Efectividad») entre:`;
  }
  return `This Development and Collaboration Agreement (the "Agreement") is entered into and made effective as of ${date} (the "Effective Date") by and between:`;
}

export function buildPrototipaloIntro(lang: AgreementLanguage): string {
  if (lang === "es") {
    return `${PROTOTIPALO_LEGAL_NAME}, sociedad debidamente constituida conforme a las leyes de España, con domicilio social en ${PROTOTIPALO_ADDRESS}, titular del NIF ${PROTOTIPALO_NIF}, debidamente representada por D. ${PROTOTIPALO_REPRESENTATIVE_NAME} en su condición de ${PROTOTIPALO_REPRESENTATIVE_POSITION} (en lo sucesivo, «Prototipalo» o el «Prestador»);`;
  }
  return `${PROTOTIPALO_LEGAL_NAME}, a company duly incorporated under the laws of Spain, with registered office at ${PROTOTIPALO_ADDRESS}, holding Spanish Tax ID (NIF) ${PROTOTIPALO_NIF}, duly represented by Mr. ${PROTOTIPALO_REPRESENTATIVE_NAME} in his capacity as ${PROTOTIPALO_REPRESENTATIVE_POSITION} (hereinafter, "Prototipalo" or the "Service Provider");`;
}

export function buildAnd(lang: AgreementLanguage): string {
  return lang === "es" ? "y" : "and";
}

export function buildCounterpartyIntro(
  signer: DevAgreementSigner | null | undefined,
  lang: AgreementLanguage,
): string {
  if (lang === "es") {
    const company = placeholder(signer?.signerCompany, "[DENOMINACIÓN LEGAL DEL CLIENTE]");
    const address = placeholder(signer?.signerAddress, "[DIRECCIÓN]");
    const taxId = placeholder(signer?.signerNif, "[NIF/CIF]");
    const repName = placeholder(signer?.signerName, "[NOMBRE COMPLETO]");
    const repPosition = placeholder(signer?.signerPosition, "[CARGO]");
    return `${company}, con domicilio social en ${address}, titular del NIF/CIF ${taxId}, debidamente representada por ${repName} en su condición de ${repPosition} (en lo sucesivo, el «Cliente»).`;
  }
  const company = placeholder(signer?.signerCompany, "[CLIENT LEGAL NAME]");
  const address = placeholder(signer?.signerAddress, "[ADDRESS]");
  const taxId = placeholder(signer?.signerNif, "[VAT/TAX ID]");
  const repName = placeholder(signer?.signerName, "[FULL NAME]");
  const repPosition = placeholder(signer?.signerPosition, "[POSITION]");
  return `${company}, with registered office at ${address}, holding Tax ID ${taxId}, duly represented by ${repName} in his/her capacity as ${repPosition} (hereinafter, the "Client").`;
}

export function getPartiesIntroParagraph(lang: AgreementLanguage): string {
  return lang === "es"
    ? "Prototipalo y el Cliente se denominan en lo sucesivo, individualmente, una «Parte» y, conjuntamente, las «Partes»."
    : 'Prototipalo and the Client are hereinafter individually referred to as a "Party" and jointly as the "Parties".';
}

// ── Recitals ───────────────────────────────────────────────────────

export function getRecitalsHeading(lang: AgreementLanguage): string {
  return lang === "es" ? "EXPONEN" : "RECITALS";
}

export function getRecitalI(lang: AgreementLanguage): string {
  return lang === "es"
    ? "Que Prototipalo se dedica al diseño, prototipado y fabricación de hardware y electrónica a medida, prestando servicios de ingeniería para sus clientes (engineering-as-a-service)."
    : "Prototipalo is engaged in the design, prototyping and manufacture of custom hardware and electronics, providing engineering-as-a-service to its clients.";
}

export function getRecitalII(projectDescription: string | null | undefined, lang: AgreementLanguage): string {
  const fallbackEs = "un dispositivo a medida cuyo alcance se detalla en el Brief del Proyecto";
  const fallbackEn = "a custom device whose scope is detailed in the Project Brief";
  const desc = placeholder(projectDescription, lang === "es" ? fallbackEs : fallbackEn);
  return lang === "es"
    ? `Que el Cliente se encuentra desarrollando ${desc} (el «Dispositivo» o el «Proyecto»).`
    : `The Client is developing ${desc} (the "Device" or the "Project").`;
}

export function getRecitalIII(ndaReferenceDate: Date | null | undefined, lang: AgreementLanguage): string {
  const date = formatNdaDate(ndaReferenceDate, lang);
  return lang === "es"
    ? `Que las Partes han suscrito previamente un Acuerdo Mutuo de Confidencialidad de fecha ${date} (el «NDA»), que permanece en pleno vigor y efecto y que se incorpora al presente Contrato por referencia.`
    : `The Parties have previously executed a Mutual Non-Disclosure Agreement dated ${date} (the "NDA"), which remains in full force and effect and is hereby incorporated into this Agreement by reference.`;
}

export function getRecitalIV(lang: AgreementLanguage): string {
  return lang === "es"
    ? "Que el Cliente desea contratar a Prototipalo para la prestación de servicios de ingeniería, prototipado y espacio de trabajo para el desarrollo del Dispositivo, en los términos establecidos en el presente Contrato."
    : "The Client wishes to engage Prototipalo to provide engineering, prototyping and workspace services for the development of the Device, on the terms set out in this Agreement.";
}

export function getNowTherefore(lang: AgreementLanguage): string {
  return lang === "es"
    ? "En virtud de lo anterior, las Partes ACUERDAN cuanto sigue:"
    : "NOW, THEREFORE, the Parties hereby agree as follows:";
}

// ── Clauses ────────────────────────────────────────────────────────

export interface ClauseSubsection {
  number: string;
  text: string;
}

export interface ClauseLetteredItem {
  letter: string;
  text: string;
}

export interface DevAgreementClause {
  number: number;
  title: string;
  body?: string;
  subsections?: ClauseSubsection[];
  letteredItems?: ClauseLetteredItem[];
}

export function getClauses(ctx: DevAgreementContext): DevAgreementClause[] {
  const { language: lang, terms } = ctx;
  const fee = fmtEur(terms.workspaceFee, lang);
  const engHours = terms.engineeringHours;
  const engRate = fmtEur(terms.engineeringRate, lang);
  const engMonthly = fmtEur(terms.engineeringHours * terms.engineeringRate, lang);
  const printHours = terms.printingHours;
  const printRate = fmtEur(terms.printingRate, lang);
  const printBag = fmtEur(terms.printingHours * terms.printingRate, lang);
  const minMonths = terms.minimumMonths;
  const threshold = fmtEur(terms.approvalThreshold, lang);

  if (lang === "es") {
    return [
      {
        number: 1,
        title: "OBJETO Y ALCANCE DE LOS SERVICIOS",
        subsections: [
          {
            number: "1.1",
            text: "Prototipalo prestará al Cliente los siguientes servicios (conjuntamente, los «Servicios»):",
          },
        ],
        letteredItems: [
          { letter: "a", text: "Servicios de ingeniería, incluyendo diseño de hardware, electrónica, firmware, diseño mecánico e industrial, integración de sensores, algoritmos, prototipado, ensayos y documentación técnica del Proyecto, según resulte necesario para el desarrollo del Dispositivo;" },
          { letter: "b", text: "Servicios de impresión 3D, materiales y fabricación a pequeña escala necesarios para el prototipado del Dispositivo;" },
          { letter: "c", text: "Espacio de trabajo en las instalaciones de Prototipalo, a disposición del Cliente y de sus representantes siempre que deseen acudir presencialmente, con independencia de que el equipo de Prototipalo se encuentre o no presente en dicho momento;" },
          { letter: "d", text: "Coordinación del Proyecto, gestión de proveedores y aprovisionamiento de componentes y materiales por cuenta del Cliente, conforme a la Cláusula 5 siguiente." },
        ],
        body: "1.2 El alcance detallado, los entregables y los hitos de cada fase del Proyecto se acordarán por escrito entre las Partes (por correo electrónico o por cualquier otro medio escrito) con carácter previo al inicio de cada fase.\n\n1.3 Prototipalo prestará los Servicios con la diligencia profesional debida, empleando personal con la cualificación técnica adecuada. El interlocutor comercial y de ingeniería de Prototipalo será D. Manu, con el apoyo adicional de Rohit y, en un rol más operativo, de Sharad.",
      },
      {
        number: 2,
        title: "HONORARIOS Y CONDICIONES ECONÓMICAS",
        subsections: [
          { number: "2.1", text: `Cuota de espacio. El Cliente abonará una cuota mensual fija de ${spellNumber(terms.workspaceFee, lang)} euros (${fee} €), IVA excluido, por el uso del espacio de trabajo de Prototipalo, con independencia de la asistencia efectiva del Cliente o de sus representantes durante dicho mes.` },
          { number: "2.2", text: `Bolsa de horas de ingeniería. Los servicios de ingeniería se facturarán en bolsas mensuales de ${spellNumber(engHours, lang)} (${engHours}) horas mensuales a una tarifa de ${spellNumber(terms.engineeringRate, lang)} euros (${engRate} €) por hora, IVA excluido, totalizando ${spellNumber(terms.engineeringHours * terms.engineeringRate, lang)} euros (${engMonthly} €) mensuales. Las horas se distribuirán entre los ingenieros asignados según las necesidades del Proyecto. Las horas adicionales por encima de la bolsa mensual podrán ser solicitadas por el Cliente y se facturarán a la misma tarifa.` },
          { number: "2.3", text: `Bolsa de horas de impresión 3D. Los servicios de impresión 3D se facturarán en bolsas de ${spellNumber(printHours, lang)} (${printHours}) horas a una tarifa de ${spellNumber(terms.printingRate, lang)} euros (${printRate} €) por hora, materiales estándar incluidos, IVA excluido, totalizando ${fmtEur(terms.printingHours * terms.printingRate, lang)} euros (${printBag} €) por bolsa. El Cliente podrá consumir una (1) bolsa al mes o solicitar bolsas adicionales según sea necesario. Los materiales especiales o no estándar (p. ej., filamentos técnicos, resinas, metales) se facturarán por separado a coste, conforme a la Cláusula 5.` },
          { number: "2.4", text: "Registro y reporte de horas. Prototipalo facilitará al Cliente un reporte mensual con el detalle de las horas de ingeniería y de impresión 3D consumidas, junto con un breve resumen de los trabajos realizados. Las horas de ingeniería o impresión no consumidas en un mes determinado no se acumularán al mes siguiente, salvo acuerdo escrito en contrario." },
          { number: "2.5", text: "IVA. Todos los honorarios, tarifas e importes establecidos en el presente Contrato se entienden expresados sin IVA, que se aplicará al tipo vigente en el momento de la facturación." },
        ],
      },
      {
        number: 3,
        title: "COMPROMISO MÍNIMO Y DURACIÓN",
        subsections: [
          { number: "3.1", text: `Compromiso mínimo. El Cliente se compromete a contratar a Prototipalo durante un período mínimo inicial de ${spellNumber(minMonths, lang)} (${minMonths}) meses consecutivos desde la Fecha de Efectividad (el «Período Mínimo»), durante el cual abonará, como mínimo, la cuota de espacio, una (1) bolsa mensual de ${spellNumber(engHours, lang)} (${engHours}) horas de ingeniería y una (1) bolsa mensual de ${spellNumber(printHours, lang)} (${printHours}) horas de impresión 3D.` },
          { number: "3.2", text: "Renovación. Transcurrido el Período Mínimo, el presente Contrato se prorrogará automáticamente por mensualidades sucesivas en los mismos términos, hasta que sea resuelto por cualquiera de las Partes conforme a la Cláusula 11." },
          { number: "3.3", text: "Resolución anticipada durante el Período Mínimo. Si el Cliente resolviera el presente Contrato antes de la finalización del Período Mínimo por causas distintas al incumplimiento material por parte de Prototipalo, abonará, en concepto de indemnización pactada, las mensualidades restantes pendientes hasta completar el Período Mínimo." },
        ],
      },
      {
        number: 4,
        title: "FACTURACIÓN Y PAGO",
        subsections: [
          { number: "4.1", text: "Prototipalo emitirá factura mensual a mes vencido, dentro de los cinco (5) primeros días naturales de cada mes, comprensiva de: (i) la cuota de espacio, (ii) la bolsa de horas de ingeniería, (iii) la bolsa de horas de impresión 3D, (iv) las horas adicionales consumidas durante el mes anterior, y (v) los componentes y materiales aprovisionados por cuenta del Cliente durante el mes anterior, conforme a la Cláusula 5." },
          { number: "4.2", text: "Plazo de pago. Las facturas serán abonadas por el Cliente mediante transferencia bancaria en el plazo de quince (15) días naturales desde la fecha de emisión, a la cuenta bancaria designada por Prototipalo." },
          { number: "4.3", text: "Demora en el pago. Sin perjuicio de cualesquiera otros derechos o remedios, los pagos demorados devengarán intereses al tipo legal de demora establecido para las operaciones comerciales en la Ley 3/2004, de 29 de diciembre, por la que se establecen medidas de lucha contra la morosidad en las operaciones comerciales. Prototipalo se reserva el derecho a suspender la prestación de los Servicios en caso de impago de cualquier factura por un período superior a treinta (30) días naturales desde su vencimiento." },
        ],
      },
      {
        number: 5,
        title: "COMPONENTES, MATERIALES Y COMPRAS A TERCEROS",
        subsections: [
          { number: "5.1", text: "Por cuenta del Cliente. Todos los componentes, piezas electrónicas, sensores, módulos, PCBs fabricadas a medida, prototipos externalizados, herramientas específicas del Proyecto, licencias de software, servicios de certificación, gastos de envío y cualesquiera otras compras a terceros necesarias para el desarrollo del Dispositivo serán por cuenta del Cliente." },
          { number: "5.2", text: "A coste. Prototipalo aprovisionará dichos elementos en nombre del Cliente y se los facturará a precio de coste, sin margen alguno, adjuntando las correspondientes facturas o albaranes de proveedor al reporte mensual. El tiempo dedicado por el equipo de Prototipalo a la gestión de compras, gestión de proveedores y coordinación de envíos se imputará a la bolsa mensual de horas de ingeniería." },
          { number: "5.3", text: `Umbral de aprobación previa. Para cualquier compra individual cuyo importe exceda de ${spellNumber(terms.approvalThreshold, lang)} euros (${threshold} €) IVA excluido, Prototipalo solicitará la aprobación previa por escrito del Cliente (siendo suficiente el correo electrónico o la mensajería instantánea). Las compras inferiores a dicho umbral podrán ser realizadas directamente por Prototipalo, en el marco del avance del Proyecto, sin necesidad de aprobación previa.` },
          { number: "5.4", text: "Pago. Los componentes y materiales aprovisionados durante un mes determinado se facturarán junto con los honorarios mensuales, a mes vencido, conforme a la Cláusula 4." },
          { number: "5.5", text: "Titularidad de los componentes. Dado que los componentes y materiales son sufragados por el Cliente, su titularidad corresponderá al Cliente desde el momento de la compra. Mientras dichos componentes permanezcan en las instalaciones de Prototipalo, formarán parte del prototipo en desarrollo y serán entregados al Cliente junto con el Dispositivo a la finalización del Proyecto o a la resolución del presente Contrato." },
          { number: "5.6", text: "Gastos de viaje y desplazamientos. En caso de que el Cliente solicite el desplazamiento del equipo de Prototipalo en el marco del Proyecto (p. ej., visitas in situ, ferias, reuniones con proveedores), los gastos razonables de viaje, alojamiento y manutención serán por cuenta del Cliente, previa aprobación." },
        ],
      },
      {
        number: 6,
        title: "PROPIEDAD INTELECTUAL E INDUSTRIAL",
        subsections: [
          { number: "6.1", text: "Propiedad intelectual preexistente (Background IP). Cada Parte conservará la titularidad de su propiedad intelectual e industrial preexistente, entendida como los derechos, know-how, herramientas, librerías, metodologías y conocimientos técnicos genéricos de cada Parte existentes con anterioridad a la Fecha de Efectividad o desarrollados de forma independiente fuera del ámbito del Proyecto." },
          { number: "6.2", text: "Propiedad intelectual resultante (Foreground IP). Todos los derechos de propiedad intelectual e industrial específicamente desarrollados por Prototipalo para el Proyecto (la «Foreground IP») —incluyendo, a título enunciativo y no limitativo, la arquitectura concreta del hardware, la configuración de sensores, el firmware, los algoritmos, el diseño mecánico y el diseño industrial del Dispositivo, así como todos los planos, esquemáticos, código fuente, documentación técnica y prototipos relacionados— serán propiedad única y exclusiva del Cliente." },
          { number: "6.3", text: "Cesión. Prototipalo cede irrevocablemente al Cliente, con plenas garantías y en la máxima medida permitida por la legislación aplicable, toda la Foreground IP, para todo uso, en todos los territorios y por toda la duración de los correspondientes derechos. Dicha cesión será efectiva al pago íntegro de las facturas correspondientes. Prototipalo otorgará, a costa razonable del Cliente, cuantos documentos adicionales resulten necesarios para perfeccionar o registrar dicha cesión a favor del Cliente." },
          { number: "6.4", text: "Uso del background IP. En la medida en que cualquier elemento del background IP de Prototipalo se incorpore necesariamente a la Foreground IP o al Dispositivo, Prototipalo concede al Cliente una licencia no exclusiva, mundial, perpetua, libre de regalías y sublicenciable para utilizar, reproducir, modificar, fabricar y comercializar dicho background IP, exclusivamente en cuanto se encuentre incorporado o resulte necesario para el uso, fabricación y comercialización del Dispositivo." },
          { number: "6.5", text: "Reserva. Prototipalo se reserva el derecho a seguir utilizando libremente su background IP —incluyendo métodos, librerías, herramientas y técnicas genéricas— en otros proyectos para terceros, siempre que dicho uso no implique la utilización ni la divulgación de Información Confidencial del Cliente, ni la reproducción del Dispositivo específico desarrollado al amparo del presente Contrato." },
          { number: "6.6", text: "Ausencia de explotación por Prototipalo. Prototipalo confirma que no tiene intención de explotar comercialmente el Dispositivo y que no lo hará, ni lo fabricará por cuenta propia o de cualquier tercero, ni desarrollará un dispositivo sustancialmente similar para ningún competidor del Cliente." },
        ],
      },
      {
        number: 7,
        title: "CONFIDENCIALIDAD",
        body: "Las obligaciones de confidencialidad de las Partes seguirán rigiéndose por el NDA referido en los Antecedentes, que permanece en pleno vigor y efecto. En caso de conflicto entre el NDA y el presente Contrato en materia de confidencialidad, prevalecerá la disposición que resulte más protectora para la Parte Reveladora.",
      },
      {
        number: 8,
        title: "PROTECCIÓN DE DATOS",
        body: "En la medida en que se produzca un intercambio de datos personales entre las Partes en relación con el presente Contrato, cada Parte se obliga a cumplir con el Reglamento (UE) 2016/679 (RGPD) y con la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD). Cuando resulte necesario, las Partes suscribirán un acuerdo de tratamiento de datos independiente con carácter previo a dicho intercambio.",
      },
      {
        number: 9,
        title: "GARANTÍAS Y RESPONSABILIDAD",
        subsections: [
          { number: "9.1", text: "Prototipalo garantiza que los Servicios se prestarán con la diligencia profesional debida y conforme a los estándares del sector. Las Partes reconocen que el Proyecto comprende actividades de investigación, desarrollo y prototipado, por lo que Prototipalo no garantiza ningún resultado técnico o comercial específico, ni un nivel de prestaciones, ni la obtención de certificación alguna, ni la idoneidad del Dispositivo para un propósito particular." },
          { number: "9.2", text: "Limitación de responsabilidad. En la máxima medida permitida por la legislación aplicable, la responsabilidad agregada de Prototipalo derivada del presente Contrato o relacionada con el mismo no excederá de un importe equivalente al total de honorarios efectivamente abonados por el Cliente a Prototipalo durante los doce (12) meses anteriores al hecho generador de la responsabilidad. Ninguna de las Partes responderá por daños indirectos, consecuenciales, especiales o punitivos, incluyendo el lucro cesante, la pérdida de negocio o la pérdida de oportunidad. Las limitaciones establecidas en la presente Cláusula no resultarán de aplicación en supuestos de dolo, culpa grave o incumplimiento de las obligaciones de confidencialidad." },
        ],
      },
      {
        number: 10,
        title: "RELACIÓN ENTRE LAS PARTES",
        body: "Prototipalo actuará como contratista independiente en la prestación de los Servicios. Nada de lo dispuesto en el presente Contrato podrá interpretarse como creador de relación laboral, societaria, joint venture o de agencia entre las Partes. Cada Parte será responsable única y exclusivamente de su propio personal, impuestos, cotizaciones a la seguridad social y obligaciones laborales.",
      },
      {
        number: 11,
        title: "DURACIÓN Y RESOLUCIÓN",
        subsections: [
          { number: "11.1", text: "Duración. El presente Contrato entrará en vigor en la Fecha de Efectividad y permanecerá vigente durante el Período Mínimo, prorrogándose automáticamente por mensualidades sucesivas conforme a la Cláusula 3." },
          { number: "11.2", text: "Resolución por conveniencia tras el Período Mínimo. Una vez transcurrido el Período Mínimo, cualquiera de las Partes podrá resolver el presente Contrato por conveniencia, mediante preaviso por escrito a la otra Parte con una antelación de treinta (30) días naturales." },
          { number: "11.3", text: "Resolución por causa. Cualquiera de las Partes podrá resolver el presente Contrato con efecto inmediato mediante notificación por escrito en caso de: (i) incumplimiento material por la otra Parte que no fuera subsanado en el plazo de quince (15) días naturales desde la notificación escrita de dicho incumplimiento; o (ii) insolvencia, concurso de acreedores o procedimiento análogo que afecte a la otra Parte." },
          { number: "11.4", text: "Efectos de la resolución. A la resolución del presente Contrato por cualquier causa: (i) el Cliente abonará todos los importes devengados y pendientes de pago a la fecha efectiva de resolución, incluyendo en su caso los importes adicionales debidos conforme a la Cláusula 3.3; (ii) Prototipalo entregará al Cliente todos los entregables, prototipos, documentación, código fuente, ficheros de diseño y componentes pagados por el Cliente, en su estado actual; y (iii) las disposiciones que por su naturaleza estén destinadas a sobrevivir a la resolución —incluyendo, a título enunciativo y no limitativo, las relativas a propiedad intelectual, confidencialidad, obligaciones de pago y limitación de responsabilidad— continuarán en pleno vigor y efecto." },
        ],
      },
      {
        number: 12,
        title: "DISPOSICIONES MISCELÁNEAS",
        subsections: [
          { number: "12.1", text: "Acuerdo íntegro. El presente Contrato, junto con el NDA, constituye el acuerdo íntegro entre las Partes con respecto a su objeto y deja sin efecto cualesquiera comunicaciones previas, orales o escritas, incluidas las ofertas o propuestas previas intercambiadas entre las Partes." },
          { number: "12.2", text: "Modificaciones. Cualquier modificación del presente Contrato deberá realizarse por escrito y ser firmada por ambas Partes. Los ajustes al alcance, entregables o fases concretas del Proyecto podrán acordarse por correo electrónico u otro medio escrito." },
          { number: "12.3", text: "Prohibición de cesión. Ninguna de las Partes podrá ceder ni transferir el presente Contrato, total o parcialmente, sin el previo consentimiento por escrito de la otra Parte, salvo en los casos de cesión a sociedades del mismo grupo, en los que bastará con el preaviso correspondiente." },
          { number: "12.4", text: "Divisibilidad. Si alguna de las cláusulas del presente Contrato fuera declarada nula o inejecutable, el resto de cláusulas conservará plena vigencia y eficacia, y las Partes negociarán de buena fe una cláusula sustitutiva válida que refleje la intención original." },
          { number: "12.5", text: "No renuncia. La falta de exigencia por cualquiera de las Partes del cumplimiento de cualquier cláusula del presente Contrato no constituirá renuncia a dicha cláusula ni a cualesquiera otros derechos derivados del mismo." },
          { number: "12.6", text: "Notificaciones. Las notificaciones formales derivadas del presente Contrato se realizarán por escrito y se remitirán mediante correo electrónico con confirmación de recepción o burofax a las direcciones que figuran en el encabezamiento del mismo. Las comunicaciones operativas del día a día del Proyecto podrán mantenerse por cualquier canal acordado, incluyendo mensajería instantánea." },
          { number: "12.7", text: "Fuerza mayor. Ninguna de las Partes responderá del incumplimiento o retraso en el cumplimiento de sus obligaciones bajo el presente Contrato cuando se deba a circunstancias razonablemente fuera de su control, incluyendo casos de fuerza mayor, desastres naturales, guerra, terrorismo, pandemias, actuaciones gubernamentales, disrupciones en la cadena de suministro de componentes electrónicos o interrupciones de servicios esenciales." },
        ],
      },
      {
        number: 13,
        title: "LEY APLICABLE Y JURISDICCIÓN",
        body: "El presente Contrato se regirá e interpretará conforme a la legislación del Reino de España. Cualquier controversia derivada o relacionada con el presente Contrato que no pudiera resolverse amistosamente entre las Partes se someterá a la jurisdicción exclusiva de los Juzgados y Tribunales de Madrid (España), con expresa renuncia a cualquier otro fuero que pudiera corresponderles.",
      },
    ];
  }

  // English clauses
  return [
    {
      number: 1,
      title: "SCOPE OF SERVICES",
      subsections: [
        { number: "1.1", text: 'Prototipalo shall provide the Client with the following services (collectively, the "Services"):' },
      ],
      letteredItems: [
        { letter: "a", text: "Engineering services, including hardware design, electronics, firmware, mechanical and industrial design, sensor integration, algorithms, prototyping, testing and project documentation, as required for the development of the Device;" },
        { letter: "b", text: "3D printing services, materials and small-scale fabrication required for the prototyping of the Device;" },
        { letter: "c", text: "Workspace at Prototipalo's facilities, available to the Client and to its representatives whenever they wish to attend in person, regardless of whether Prototipalo's team is present at that time;" },
        { letter: "d", text: "Project coordination, supplier management and procurement of components and materials on behalf of the Client, in accordance with Section 5 below." },
      ],
      body: "1.2 The detailed scope, deliverables and milestones for each phase of the Project shall be agreed in writing between the Parties (by email or any other written means) prior to the commencement of each phase.\n\n1.3 Prototipalo shall perform the Services with due professional care and diligence, employing personnel with the appropriate technical skills. Prototipalo's commercial and engineering point of contact shall be Mr. Manu, with the additional support of Rohit and, on a more hands-on basis, Sharad.",
    },
    {
      number: 2,
      title: "FEES AND COMMERCIAL TERMS",
      subsections: [
        { number: "2.1", text: `Workspace fee. The Client shall pay a fixed monthly fee of ${spellNumber(terms.workspaceFee, lang)} euros (€${fee}), excluding VAT, for the use of Prototipalo's workspace, irrespective of actual attendance by the Client or its representatives during such month.` },
        { number: "2.2", text: `Engineering hours. Engineering services shall be invoiced in monthly bags of ${spellNumber(engHours, lang)} (${engHours}) hours per month at a rate of ${spellNumber(terms.engineeringRate, lang)} euros (€${engRate}) per hour, excluding VAT, totalling ${spellNumber(terms.engineeringHours * terms.engineeringRate, lang)} euros (€${engMonthly}) per month. Hours shall be allocated between the assigned engineers as required by the Project. Additional hours beyond the monthly bag may be requested by the Client and shall be invoiced at the same rate.` },
        { number: "2.3", text: `3D printing hours. 3D printing services shall be invoiced in bags of ${spellNumber(printHours, lang)} (${printHours}) hours at a rate of ${spellNumber(terms.printingRate, lang)} euros (€${printRate}) per hour, standard materials included, excluding VAT, totalling ${fmtEur(terms.printingHours * terms.printingRate, lang)} euros (€${printBag}) per bag. The Client may consume one (1) bag per month or request additional bags as needed. Special or non-standard materials (e.g. engineering-grade filaments, resins, metals) shall be invoiced separately at cost in accordance with Section 5.` },
        { number: "2.4", text: "Hour tracking and reporting. Prototipalo shall provide the Client with a monthly report detailing engineering hours and 3D printing hours consumed, together with a brief summary of the work carried out. Unused engineering or printing hours within a given month shall not roll over to the following month, unless otherwise agreed in writing." },
        { number: "2.5", text: "VAT. All fees, rates and amounts set out in this Agreement are stated excluding Value Added Tax (VAT), which shall be applied at the rate in force at the time of invoicing." },
      ],
    },
    {
      number: 3,
      title: "MINIMUM COMMITMENT AND TERM",
      subsections: [
        { number: "3.1", text: `Minimum commitment. The Client undertakes to engage Prototipalo for a minimum initial period of ${spellNumber(minMonths, lang)} (${minMonths}) consecutive months from the Effective Date (the "Minimum Term"), during which the Client shall pay, as a minimum, the workspace fee, one (1) monthly bag of ${spellNumber(engHours, lang)} (${engHours}) engineering hours and one (1) monthly bag of ${spellNumber(printHours, lang)} (${printHours}) 3D printing hours.` },
        { number: "3.2", text: "Renewal. Upon expiry of the Minimum Term, this Agreement shall automatically renew on a month-to-month basis under the same terms, until terminated by either Party in accordance with Section 11." },
        { number: "3.3", text: "Early termination during Minimum Term. If the Client terminates this Agreement before the end of the Minimum Term for reasons other than a material breach by Prototipalo, the Client shall pay, as agreed compensation, the remaining monthly fees due under the Minimum Term." },
      ],
    },
    {
      number: 4,
      title: "INVOICING AND PAYMENT",
      subsections: [
        { number: "4.1", text: "Prototipalo shall issue a monthly invoice in arrears, within the first five (5) calendar days of each month, covering: (i) the workspace fee, (ii) the engineering hours bag, (iii) the 3D printing hours bag, (iv) any additional hours consumed during the previous month, and (v) any components and materials procured on behalf of the Client during the previous month, in accordance with Section 5." },
        { number: "4.2", text: "Payment terms. Invoices shall be paid by the Client by bank transfer within fifteen (15) calendar days of the invoice date, to the bank account designated by Prototipalo." },
        { number: "4.3", text: "Late payment. Without prejudice to any other rights or remedies, late payment shall accrue interest at the legal rate for late payment in commercial transactions established by Spanish Law 3/2004 of 29 December, on measures to combat late payment in commercial transactions. Prototipalo reserves the right to suspend the Services in the event that any invoice remains unpaid for more than thirty (30) calendar days from its due date." },
      ],
    },
    {
      number: 5,
      title: "COMPONENTS, MATERIALS AND THIRD-PARTY PURCHASES",
      subsections: [
        { number: "5.1", text: "Client's expense. All components, electronic parts, sensors, modules, custom-manufactured PCBs, externally outsourced prototypes, project-specific tooling, software licences, certification services, shipping costs, and any other purchases from third parties required for the development of the Device shall be borne by the Client." },
        { number: "5.2", text: "At cost. Prototipalo shall procure such items on behalf of the Client and invoice them at cost, with no mark-up, attaching the corresponding supplier invoices or delivery notes to the monthly report. The time spent by Prototipalo's team on procurement, supplier management and shipping coordination shall be charged against the monthly engineering hours bag." },
        { number: "5.3", text: `Prior approval threshold. For any individual purchase exceeding ${spellNumber(terms.approvalThreshold, lang)} euros (€${threshold}) excluding VAT, Prototipalo shall request prior written approval from the Client (email or instant messaging being sufficient). Purchases below such threshold may be made directly by Prototipalo, within the framework of the Project's progress, without the need for prior approval.` },
        { number: "5.4", text: "Payment. Components and materials procured during a given month shall be invoiced together with the monthly fees, in arrears, in accordance with Section 4." },
        { number: "5.5", text: "Ownership of components. As components and materials are paid for by the Client, ownership thereof shall vest in the Client from the moment of purchase. While such components remain at Prototipalo's facilities, they shall form part of the prototype under development and shall be delivered to the Client together with the Device upon completion or upon termination of this Agreement." },
        { number: "5.6", text: "Travel and out-of-pocket expenses. Should the Client request Prototipalo's team to travel for the purposes of the Project (e.g. on-site visits, trade fairs, supplier meetings), reasonable travel, accommodation and subsistence expenses shall be borne by the Client, subject to prior approval." },
      ],
    },
    {
      number: 6,
      title: "INTELLECTUAL AND INDUSTRIAL PROPERTY",
      subsections: [
        { number: "6.1", text: "Background IP. Each Party shall retain ownership of its background intellectual property, meaning all rights, know-how, tools, libraries, methodologies and generic technical knowledge of such Party existing prior to the Effective Date or developed independently outside the scope of the Project." },
        { number: "6.2", text: 'Foreground IP. All intellectual and industrial property rights specifically developed by Prototipalo for the Project (the "Foreground IP") — including, without limitation, the specific hardware architecture, sensor configuration, firmware, algorithms, mechanical design and industrial design of the Device, as well as all related drawings, schematics, source code, technical documentation and prototypes — shall be the sole and exclusive property of the Client.' },
        { number: "6.3", text: "Assignment. Prototipalo hereby irrevocably assigns to the Client, with full title guarantee and to the maximum extent permitted by applicable law, all Foreground IP, for all uses, in all territories, and for the entire duration of the corresponding rights. Such assignment shall be effective upon full payment of the corresponding invoices. Prototipalo shall execute, at the Client's reasonable cost, any further documents necessary to perfect or register such assignment in the Client's name." },
        { number: "6.4", text: "Use of background IP. To the extent that any of Prototipalo's background IP is necessarily incorporated into the Foreground IP or the Device, Prototipalo grants the Client a non-exclusive, worldwide, perpetual, royalty-free, sublicensable licence to use, reproduce, modify, manufacture and commercialise such background IP solely as embedded in or necessary for the use, manufacture and commercialisation of the Device." },
        { number: "6.5", text: "Reservation. Prototipalo reserves the right to continue freely using its background IP — including generic methods, libraries, tools and techniques — in other projects for third parties, provided that such use does not involve any use or disclosure of the Client's Confidential Information, nor the reproduction of the specific Device developed under this Agreement." },
        { number: "6.6", text: "No commercialisation by Prototipalo. Prototipalo confirms that it has no intention of, and shall not, commercially exploit the Device, manufacture it for its own account or for any third party, or develop a substantially similar device for any competitor of the Client." },
      ],
    },
    {
      number: 7,
      title: "CONFIDENTIALITY",
      body: "The confidentiality obligations of the Parties shall continue to be governed by the NDA referred to in the Recitals, which remains in full force and effect. In the event of any conflict between the NDA and this Agreement in respect of confidentiality, the more protective provision for the Disclosing Party shall prevail.",
    },
    {
      number: 8,
      title: "DATA PROTECTION",
      body: "To the extent any exchange of personal data takes place between the Parties in connection with this Agreement, each Party shall comply with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 of 5 December on the Protection of Personal Data and the guarantee of digital rights (LOPDGDD). Where required, the Parties shall execute a separate data processing agreement prior to any such exchange.",
    },
    {
      number: 9,
      title: "WARRANTIES AND LIABILITY",
      subsections: [
        { number: "9.1", text: "Prototipalo warrants that the Services shall be performed with due professional care and in accordance with industry standards. The Parties acknowledge that the Project involves research, development and prototyping activities and that, accordingly, Prototipalo does not warrant any specific technical or commercial result, performance level, certification outcome or fitness for a particular purpose of the Device." },
        { number: "9.2", text: "Limitation of liability. To the maximum extent permitted by applicable law, Prototipalo's aggregate liability arising out of or in connection with this Agreement shall not exceed an amount equal to the total fees actually paid by the Client to Prototipalo during the twelve (12) months preceding the event giving rise to liability. Neither Party shall be liable for indirect, consequential, special or punitive damages, including loss of profits, loss of business or loss of opportunity. The limitations set forth in this Section shall not apply in cases of wilful misconduct, gross negligence or breach of confidentiality obligations." },
      ],
    },
    {
      number: 10,
      title: "INDEPENDENT CONTRACTOR RELATIONSHIP",
      body: "Prototipalo shall act as an independent contractor in the performance of the Services. Nothing in this Agreement shall be construed as creating any employment, partnership, joint venture or agency relationship between the Parties. Each Party shall be solely responsible for its own personnel, taxes, social security contributions and labour obligations.",
    },
    {
      number: 11,
      title: "TERM AND TERMINATION",
      subsections: [
        { number: "11.1", text: "Term. This Agreement shall enter into force on the Effective Date and shall remain in force during the Minimum Term, automatically renewing thereafter on a month-to-month basis as set out in Section 3." },
        { number: "11.2", text: "Termination for convenience after Minimum Term. Following the Minimum Term, either Party may terminate this Agreement for convenience by giving the other Party thirty (30) calendar days' prior written notice." },
        { number: "11.3", text: "Termination for cause. Either Party may terminate this Agreement with immediate effect by written notice in the event of: (i) a material breach by the other Party which is not cured within fifteen (15) calendar days following written notice of such breach; or (ii) the insolvency, bankruptcy or analogous proceeding affecting the other Party." },
        { number: "11.4", text: "Effects of termination. Upon termination of this Agreement for any reason: (i) the Client shall pay all amounts accrued and unpaid up to the effective date of termination, including any additional amounts due under Section 3.3 if applicable; (ii) Prototipalo shall deliver to the Client all deliverables, prototypes, documentation, source code, design files and components paid for by the Client, in their then-current state; and (iii) the provisions which by their nature are intended to survive termination — including, without limitation, intellectual property, confidentiality, payment obligations and limitation of liability — shall continue in full force and effect." },
      ],
    },
    {
      number: 12,
      title: "MISCELLANEOUS",
      subsections: [
        { number: "12.1", text: "Entire Agreement. This Agreement, together with the NDA, constitutes the entire understanding between the Parties with respect to its subject matter and supersedes all prior oral or written communications, including any prior offers or proposals exchanged between the Parties." },
        { number: "12.2", text: "Amendments. Any amendment or modification to this Agreement shall be made in writing and signed by both Parties. Adjustments to the scope, deliverables or specific phases of the Project may be agreed by email or other written means." },
        { number: "12.3", text: "No Assignment. Neither Party may assign or transfer this Agreement, in whole or in part, without the prior written consent of the other Party, save for assignments to affiliates within the same corporate group, in which case prior notice shall suffice." },
        { number: "12.4", text: "Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the Parties shall negotiate in good faith a valid substitute provision reflecting their original intent." },
        { number: "12.5", text: "No Waiver. The failure of either Party to enforce any provision of this Agreement shall not constitute a waiver of such provision or of any other right under this Agreement." },
        { number: "12.6", text: "Notices. All formal notices under this Agreement shall be in writing and sent by email with confirmation of receipt or by registered post to the addresses set out in the heading of this Agreement. Day-to-day project communications may take place through any agreed channel, including instant messaging." },
        { number: "12.7", text: "Force Majeure. Neither Party shall be liable for any failure or delay in the performance of its obligations under this Agreement to the extent caused by events beyond its reasonable control, including acts of God, natural disasters, war, terrorism, pandemics, governmental actions, supply chain disruptions affecting electronic components, or interruptions of essential services." },
      ],
    },
    {
      number: 13,
      title: "GOVERNING LAW AND JURISDICTION",
      body: "This Agreement shall be governed by and construed in accordance with the laws of the Kingdom of Spain. Any dispute arising out of or in connection with this Agreement that cannot be amicably resolved by the Parties shall be submitted to the exclusive jurisdiction of the Courts and Tribunals of Madrid, Spain, with express waiver of any other forum that may correspond to them.",
    },
  ];
}

// ── Closing + signatures ───────────────────────────────────────────

export function getSignaturesHeading(lang: AgreementLanguage): string {
  return lang === "es" ? "FIRMAS" : "SIGNATURES";
}

export function getClosingParagraph(lang: AgreementLanguage): string {
  return lang === "es"
    ? "Y EN PRUEBA DE CONFORMIDAD, las Partes firman el presente Contrato en dos (2) ejemplares idénticos y a un solo efecto, en la fecha y lugar indicados a continuación."
    : "IN WITNESS WHEREOF, the Parties execute this Agreement in two (2) identical counterparts, each of equal legal effect, on the date and at the place set forth below.";
}

export function getOnBehalfOf(lang: AgreementLanguage): string {
  return lang === "es" ? "Por" : "On behalf of";
}

export function getSignatureLabels(lang: AgreementLanguage): {
  name: string;
  position: string;
  date: string;
  place: string;
} {
  return lang === "es"
    ? { name: "Nombre", position: "Cargo", date: "Fecha", place: "Lugar" }
    : { name: "Name", position: "Position", date: "Date", place: "Place" };
}

// ── Annex A ────────────────────────────────────────────────────────

export function getAnnexHeading(lang: AgreementLanguage): string {
  return lang === "es"
    ? "ANEXO A — RESUMEN COMERCIAL"
    : "ANNEX A — COMMERCIAL SUMMARY";
}

export function getAnnexIntro(lang: AgreementLanguage): string {
  return lang === "es"
    ? "A efectos de claridad, las principales condiciones económicas acordadas en el presente Contrato se resumen a continuación. En caso de discrepancia entre el presente Anexo y el cuerpo del Contrato, prevalecerá el cuerpo del Contrato."
    : "For the convenience of the Parties, the main commercial terms agreed under this Agreement are summarised below. In the event of any discrepancy between this Annex and the body of the Agreement, the body of the Agreement shall prevail.";
}

export function getAnnexItems(ctx: DevAgreementContext): string[] {
  const { language: lang, terms } = ctx;
  const fee = fmtEur(terms.workspaceFee, lang);
  const engRate = fmtEur(terms.engineeringRate, lang);
  const engMonthly = fmtEur(terms.engineeringHours * terms.engineeringRate, lang);
  const printRate = fmtEur(terms.printingRate, lang);
  const printBag = fmtEur(terms.printingHours * terms.printingRate, lang);
  const minimumMonthly = fmtEur(
    terms.workspaceFee + terms.engineeringHours * terms.engineeringRate + terms.printingHours * terms.printingRate,
    lang,
  );
  const threshold = fmtEur(terms.approvalThreshold, lang);

  if (lang === "es") {
    return [
      `Cuota de espacio: ${fee} € / mes (IVA excluido)`,
      `Bolsa de ingeniería: ${terms.engineeringHours} horas / mes a ${engRate} € / hora = ${engMonthly} € / mes (IVA excluido)`,
      `Bolsa de impresión 3D: ${terms.printingHours} horas / bolsa a ${printRate} € / hora, materiales estándar incluidos = ${printBag} € / bolsa (IVA excluido)`,
      `Componentes y compras: a coste, sin margen; aprobación previa por escrito requerida para compras superiores a ${threshold} € (IVA excluido)`,
      `Cuota mensual mínima: ${minimumMonthly} € / mes (IVA excluido, sin contar componentes)`,
      `Período Mínimo: ${terms.minimumMonths} meses consecutivos desde la Fecha de Efectividad`,
      "Plazo de pago: factura mensual a mes vencido, pagadera en 15 días",
      "Foreground IP: propiedad del Cliente",
    ];
  }
  return [
    `Workspace fee: €${fee} / month (excl. VAT)`,
    `Engineering bag: ${terms.engineeringHours} hours / month at €${engRate} / hour = €${engMonthly} / month (excl. VAT)`,
    `3D printing bag: ${terms.printingHours} hours / bag at €${printRate} / hour, standard materials included = €${printBag} / bag (excl. VAT)`,
    `Components & purchases: at cost, no mark-up; prior written approval required for purchases above €${threshold} (excl. VAT)`,
    `Minimum total monthly fee: €${minimumMonthly} / month (excl. VAT, excluding components)`,
    `Minimum Term: ${terms.minimumMonths} consecutive months from the Effective Date`,
    "Payment terms: monthly invoice in arrears, payable within 15 days",
    "Foreground IP: owned by the Client",
  ];
}
