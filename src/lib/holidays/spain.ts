export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  scope: "national" | "madrid";
}

export function getSpainHolidays(year: number): Holiday[] {
  // Festivos nacionales fijos
  const national: Holiday[] = [
    { date: `${year}-01-01`, name: "Año Nuevo", scope: "national" },
    { date: `${year}-01-06`, name: "Reyes Magos", scope: "national" },
    { date: `${year}-05-01`, name: "Día del Trabajo", scope: "national" },
    { date: `${year}-08-15`, name: "Asunción de la Virgen", scope: "national" },
    { date: `${year}-10-12`, name: "Fiesta Nacional", scope: "national" },
    { date: `${year}-11-01`, name: "Todos los Santos", scope: "national" },
    { date: `${year}-12-06`, name: "Constitución", scope: "national" },
    { date: `${year}-12-08`, name: "Inmaculada Concepción", scope: "national" },
    { date: `${year}-12-25`, name: "Navidad", scope: "national" },
  ];

  // Semana Santa (variable) — calculated for specific years
  const easterDates: Record<number, string> = {
    2025: `2025-04-20`,
    2026: `2026-04-05`,
    2027: `2027-03-28`,
    2028: `2028-04-16`,
    2029: `2029-04-01`,
    2030: `2030-04-21`,
  };

  const easter = easterDates[year];
  if (easter) {
    const easterDate = new Date(easter);
    // Jueves Santo (Easter - 3 days)
    const jueves = new Date(easterDate);
    jueves.setDate(jueves.getDate() - 3);
    // Viernes Santo (Easter - 2 days)
    const viernes = new Date(easterDate);
    viernes.setDate(viernes.getDate() - 2);

    national.push(
      { date: formatDate(jueves), name: "Jueves Santo", scope: "national" },
      { date: formatDate(viernes), name: "Viernes Santo", scope: "national" },
    );
  }

  // Festivos Comunidad de Madrid
  const madrid: Holiday[] = [
    { date: `${year}-03-19`, name: "San José (Madrid)", scope: "madrid" },
    { date: `${year}-05-02`, name: "Comunidad de Madrid", scope: "madrid" },
    { date: `${year}-05-15`, name: "San Isidro (Madrid)", scope: "madrid" },
    { date: `${year}-11-09`, name: "Almudena (Madrid)", scope: "madrid" },
  ];

  return [...national, ...madrid].sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
