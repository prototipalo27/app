// Mutual Non-Disclosure Agreement template for Studio projects.
// Shared between the HTML preview (`/nda/[token]`) and the PDF generator
// (`studio-nda-pdf.ts`) so any wording change applies to both at once.

export const PROTOTIPALO_LEGAL_NAME = "PROTOTIPALO, S.L.";
export const PROTOTIPALO_ADDRESS = "Calle Viriato 27, 28010 Madrid, Spain";
export const PROTOTIPALO_NIF = "B72410665";
export const PROTOTIPALO_REPRESENTATIVE_NAME = "Manuel de la Viña";
export const PROTOTIPALO_REPRESENTATIVE_POSITION = "CEO";

export const DEFAULT_PROJECT_DESCRIPTION =
  "the products, services and intellectual property developed under this collaboration";

export interface StudioNdaSigner {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signerPosition?: string;
}

export interface StudioNdaContext {
  /** Effective date of the agreement. */
  effectiveDate?: Date | null;
  /** Free-form project description used in Recital I. */
  projectDescription?: string | null;
  /** Signer data — null on the preview screen before the user fills the form. */
  signer?: StudioNdaSigner | null;
}

function placeholder(value: string | null | undefined, fallback: string): string {
  const v = value?.trim();
  return v ? v : fallback;
}

export function formatEffectiveDate(d: Date | null | undefined): string {
  if (!d) return "[EFFECTIVE DATE]";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}

export function buildPrototipaloIntro(): string {
  return `${PROTOTIPALO_LEGAL_NAME}, a company duly incorporated under the laws of Spain, with registered office at ${PROTOTIPALO_ADDRESS}, holding Spanish Tax ID (NIF) ${PROTOTIPALO_NIF}, duly represented by Mr. ${PROTOTIPALO_REPRESENTATIVE_NAME} in his capacity as ${PROTOTIPALO_REPRESENTATIVE_POSITION} (hereinafter, "Prototipalo");`;
}

export function buildCounterpartyIntro(signer: StudioNdaSigner | null | undefined): string {
  const company = placeholder(signer?.signerCompany, "[COUNTERPARTY LEGAL NAME]");
  const address = placeholder(signer?.signerAddress, "[ADDRESS]");
  const taxId = placeholder(signer?.signerNif, "[VAT/TAX ID]");
  const repName = placeholder(signer?.signerName, "[FULL NAME]");
  const repPosition = placeholder(signer?.signerPosition, "[POSITION]");
  return `${company}, with registered office / domicile at ${address}, holding Tax ID ${taxId}, duly represented by ${repName} in his/her capacity as ${repPosition} (hereinafter, the "Counterparty").`;
}

export function buildRecitalI(projectDescription: string | null | undefined): string {
  const desc = placeholder(projectDescription, DEFAULT_PROJECT_DESCRIPTION);
  return `Prototipalo is engaged in the design, prototyping and manufacture of custom hardware and electronics, and is developing ${desc} (the "Project").`;
}

export const RECITAL_II =
  'The Parties wish to explore a potential business and/or technical collaboration in connection with the Project (the "Purpose"), which may require the mutual disclosure of confidential, technical, commercial and proprietary information.';

export const RECITAL_III =
  "The Parties wish to set forth in writing the terms and conditions under which such information shall be exchanged and protected.";

export interface ClauseSubsection {
  number: string;
  text: string;
}

export interface NdaClause {
  number: number;
  title: string;
  body?: string;
  subsections?: ClauseSubsection[];
  /** Lettered list (a)..(f) */
  letteredItems?: { letter: string; text: string }[];
  /** Optional opener before the lettered list. */
  letteredIntro?: string;
}

export const STUDIO_NDA_CLAUSES: NdaClause[] = [
  {
    number: 1,
    title: "DEFINITION OF CONFIDENTIAL INFORMATION",
    subsections: [
      {
        number: "1.1",
        text: 'For the purposes of this Agreement, "Confidential Information" means any and all information, in any form or medium (whether oral, written, electronic, visual, tangible or intangible), disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party") before or after the Effective Date in connection with the Purpose, including without limitation:',
      },
    ],
    letteredItems: [
      { letter: "a", text: "the existence, scope, status and content of the Project and of this Agreement;" },
      { letter: "b", text: "hardware designs, schematics, PCB layouts, BOMs, mechanical drawings, CAD/CAM files, 3D models, enclosures, sensors, firmware, source code, algorithms, machine-learning models, datasets, training data and biometric/biomechanical data collected;" },
      { letter: "c", text: "industrial designs, prototypes, samples, test results, performance data, certifications and regulatory documentation;" },
      { letter: "d", text: "inventions, know-how, methodologies, processes, manufacturing techniques, supplier and component lists, and any patentable or unpatented technical information;" },
      { letter: "e", text: "business plans, commercial strategies, pricing, financial information, customer and prospect lists, partner information and marketing materials;" },
      { letter: "f", text: "any information that, by its nature or by the circumstances of its disclosure, a reasonable person would understand to be confidential, whether or not marked or identified as such." },
    ],
    body:
      "1.2 Confidential Information shall include all copies, extracts, summaries, analyses, notes and derivative works thereof prepared by the Receiving Party or its Representatives (as defined below).",
  },
  {
    number: 2,
    title: "EXCLUSIONS",
    body: "The obligations under this Agreement shall not apply to information that the Receiving Party can demonstrate, by competent written evidence:",
    letteredItems: [
      { letter: "a", text: "was already in its lawful possession, free of any obligation of confidentiality, prior to disclosure by the Disclosing Party;" },
      { letter: "b", text: "is or becomes publicly available through no act or omission of the Receiving Party or its Representatives;" },
      { letter: "c", text: "is lawfully obtained from a third party who was not under any obligation of confidentiality with respect to such information;" },
      { letter: "d", text: "is independently developed by the Receiving Party without any use of or reference to the Confidential Information." },
    ],
  },
  {
    number: 3,
    title: "OBLIGATIONS OF THE RECEIVING PARTY",
    body: "The Receiving Party undertakes to:",
    letteredItems: [
      { letter: "a", text: "use the Confidential Information solely and exclusively for the Purpose, and for no other purpose whatsoever;" },
      { letter: "b", text: "keep the Confidential Information strictly confidential and protect it with at least the same degree of care it uses to protect its own confidential information of similar nature, and in no event with less than a reasonable standard of care;" },
      { letter: "c", text: "not disclose, transfer, publish, reveal or make available the Confidential Information to any third party without the prior written consent of the Disclosing Party;" },
      { letter: "d", text: "not copy, reproduce, reverse engineer, decompile, disassemble, modify or create derivative works from any prototype, sample, firmware, hardware or software embodying Confidential Information, except to the strict extent required by the Purpose and expressly authorized in writing;" },
      { letter: "e", text: "not file, register or attempt to register any patent, utility model, design, trademark, domain name or any other intellectual or industrial property right based on or incorporating the Confidential Information of the Disclosing Party;" },
      { letter: "f", text: "promptly notify the Disclosing Party in writing of any actual or suspected unauthorized use, access or disclosure of Confidential Information, and cooperate in all reasonable measures to mitigate such breach." },
    ],
  },
  {
    number: 4,
    title: "AUTHORIZED REPRESENTATIVES",
    subsections: [
      {
        number: "4.1",
        text: 'The Receiving Party may disclose Confidential Information only to its directors, officers, employees, contractors, advisors and subcontractors (the "Representatives") who (i) have a strict need to know such information for the Purpose, and (ii) are bound by written confidentiality obligations no less stringent than those set forth in this Agreement, or by equivalent professional duties of confidentiality.',
      },
      {
        number: "4.2",
        text: "The Receiving Party shall be fully liable for any act or omission of its Representatives as if such acts or omissions had been carried out by the Receiving Party itself.",
      },
    ],
  },
  {
    number: 5,
    title: "INTELLECTUAL AND INDUSTRIAL PROPERTY",
    subsections: [
      {
        number: "5.1",
        text: "All Confidential Information shall remain the exclusive property of the Disclosing Party. Nothing in this Agreement shall be construed as granting, by implication, estoppel or otherwise, any licence, assignment or transfer of any patent, utility model, copyright, trademark, design right, trade secret or any other intellectual or industrial property right to the Receiving Party.",
      },
      {
        number: "5.2",
        text: "In particular, the Parties expressly acknowledge that any background intellectual property of Prototipalo relating to the Project — including hardware architecture, sensor configurations, firmware, algorithms, mechanical design and industrial design — shall remain the sole and exclusive property of Prototipalo.",
      },
      {
        number: "5.3",
        text: "Should the collaboration between the Parties evolve toward joint development, the ownership of any resulting intellectual or industrial property rights shall be governed by a separate written agreement to be executed by the Parties.",
      },
    ],
  },
  {
    number: 6,
    title: "NON-CIRCUMVENTION AND NON-USE",
    body:
      "During the term of this Agreement and for a period of two (2) years thereafter, the Receiving Party shall not, directly or indirectly, use the Confidential Information to: (i) develop, manufacture, market or sell any product or service that competes with the Project; (ii) approach, contact or solicit any supplier, manufacturer, customer, investor or partner of the Disclosing Party identified through Confidential Information, with the aim of circumventing the Disclosing Party; or (iii) reverse engineer or attempt to derive the design, composition or operating principles of any prototype or sample disclosed under this Agreement.",
  },
  {
    number: 7,
    title: "RETURN OR DESTRUCTION OF CONFIDENTIAL INFORMATION",
    body:
      "Upon written request of the Disclosing Party, or upon termination of this Agreement for any reason, the Receiving Party shall, at the Disclosing Party's option and within fifteen (15) calendar days, return or securely destroy all Confidential Information in its possession or under its control, including all copies, extracts and derivative works, and shall certify such return or destruction in writing. The Receiving Party may retain one (1) archival copy solely for legal compliance purposes, which shall remain subject to the confidentiality obligations of this Agreement indefinitely.",
  },
  {
    number: 8,
    title: "MANDATORY DISCLOSURE BY LAW",
    body:
      "If the Receiving Party is legally compelled (by subpoena, court order, regulatory requirement or otherwise) to disclose Confidential Information, it shall, to the extent legally permitted, give the Disclosing Party prompt prior written notice so that the Disclosing Party may seek a protective order or other appropriate remedy. The Receiving Party shall disclose only that portion of the Confidential Information that is strictly required and shall use reasonable efforts to ensure that confidential treatment is afforded to the disclosed information.",
  },
  {
    number: 9,
    title: "NO WARRANTY",
    body:
      'All Confidential Information is provided "AS IS", without any warranty of any kind, express or implied, as to its accuracy, completeness, fitness for a particular purpose, non-infringement or otherwise. The Disclosing Party shall not be liable to the Receiving Party for any damages arising from the use of, or reliance on, the Confidential Information.',
  },
  {
    number: 10,
    title: "NO OBLIGATION TO TRANSACT",
    body:
      "Nothing in this Agreement shall be construed as obliging either Party to enter into any further agreement, business relationship or transaction with the other Party. Any such future relationship shall be the subject of a separate written agreement.",
  },
  {
    number: 11,
    title: "TERM AND DURATION OF OBLIGATIONS",
    subsections: [
      {
        number: "11.1",
        text: "This Agreement shall enter into force on the Effective Date and shall remain in force for a period of two (2) years, unless earlier terminated by either Party with thirty (30) days' prior written notice.",
      },
      {
        number: "11.2",
        text: "Notwithstanding the termination or expiration of this Agreement, the confidentiality obligations set forth herein shall survive for a period of five (5) years from the date of termination or expiration. Confidential Information that qualifies as a trade secret under applicable law shall remain protected for as long as it retains such status.",
      },
    ],
  },
  {
    number: 12,
    title: "PERSONAL DATA",
    body:
      "To the extent any exchange of personal data takes place between the Parties in connection with this Agreement, each Party shall comply with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 of 5 December on the Protection of Personal Data and the guarantee of digital rights (LOPDGDD). Where required, the Parties shall execute a separate data processing agreement prior to any such exchange.",
  },
  {
    number: 13,
    title: "BREACH AND REMEDIES",
    body:
      "The Parties acknowledge that any breach of this Agreement may cause irreparable harm to the Disclosing Party for which monetary damages alone may be inadequate. Accordingly, the Disclosing Party shall be entitled to seek injunctive relief and any other equitable remedies, in addition to any other remedies available at law, without prejudice to the right to claim compensation for damages actually suffered.",
  },
  {
    number: 14,
    title: "MISCELLANEOUS",
    subsections: [
      { number: "14.1", text: "Entire Agreement. This Agreement constitutes the entire understanding between the Parties with respect to its subject matter and supersedes all prior oral or written communications relating thereto." },
      { number: "14.2", text: "Amendments. Any amendment or modification to this Agreement shall be made in writing and signed by both Parties." },
      { number: "14.3", text: "No Assignment. Neither Party may assign or transfer this Agreement, in whole or in part, without the prior written consent of the other Party." },
      { number: "14.4", text: "Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the Parties shall negotiate in good faith a valid substitute provision reflecting their original intent." },
      { number: "14.5", text: "No Waiver. The failure of either Party to enforce any provision of this Agreement shall not constitute a waiver of such provision or of any other right under this Agreement." },
      { number: "14.6", text: "Notices. All notices under this Agreement shall be in writing and sent to the addresses set out in the heading of this Agreement, by email with confirmation of receipt or by registered post." },
    ],
  },
  {
    number: 15,
    title: "GOVERNING LAW AND JURISDICTION",
    body:
      "This Agreement shall be governed by and construed in accordance with the laws of the Kingdom of Spain. Any dispute arising out of or in connection with this Agreement that cannot be amicably resolved by the Parties shall be submitted to the exclusive jurisdiction of the Courts and Tribunals of Madrid, Spain, with express waiver of any other forum that may correspond to them.",
  },
];

export const CLOSING_PARAGRAPH =
  "IN WITNESS WHEREOF, the Parties execute this Agreement in two (2) identical counterparts, each of equal legal effect, on the date and at the place set forth below.";

export const PARTIES_INTRO_PARAGRAPH =
  'Prototipalo and the Counterparty are hereinafter individually referred to as a "Party" and jointly as the "Parties". Each Party may act as Disclosing Party or as Receiving Party depending on the flow of information.';

export const NOW_THEREFORE = "NOW, THEREFORE, the Parties hereby agree as follows:";
