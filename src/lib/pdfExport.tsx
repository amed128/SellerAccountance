import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Dict, Locale } from "./i18n";
import type { VatExportInput } from "./csvExport";
import { formatMoney } from "./format";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthLabel(month: string, locale: Locale, undated: string) {
  if (!month) return undated;
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", {
    month: "long",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  h1: { fontSize: 16, fontWeight: 700 },
  brand: { fontSize: 9, color: "#6b7280", marginBottom: 4 },
  meta: { fontSize: 9, color: "#6b7280", marginTop: 4, marginBottom: 14 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  boldRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#111827",
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontWeight: 700,
  },
  right: { textAlign: "right" },
});

interface Cell {
  text: string;
  flex?: number;
  right?: boolean;
}

type RowStyle = "row" | "headerRow" | "boldRow";

function Row({ cells, rowStyle }: { cells: Cell[]; rowStyle: RowStyle }) {
  return (
    <View style={styles[rowStyle]}>
      {cells.map((c, i) => (
        <Text key={i} style={[{ flex: c.flex ?? 1 }, ...(c.right ? [styles.right] : [])]}>
          {c.text}
        </Text>
      ))}
    </View>
  );
}

export function VatExportDocument({
  input,
  locale,
  d,
}: {
  input: VatExportInput;
  locale: Locale;
  d: Dict;
}) {
  const t = d.dashboard;
  const x = d.export;
  const s = input.summary;
  const money = (n: number) => formatMoney(n, locale, s.currency);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>SellerAccountance</Text>
        <Text style={styles.h1}>{input.title}</Text>
        <Text style={styles.meta}>
          {x.generatedOn} {iso(new Date())}
          {/* en dash, not the "→" arrow used on-screen: the standard PDF Helvetica
              font's WinAnsi encoding has no glyph for it and would render garbage */}
          {input.period && `  ·  ${x.period}: ${iso(input.period.start)} – ${iso(input.period.end)}`}
          {input.reportsIncluded !== undefined && `  ·  ${x.reportsIncluded}: ${input.reportsIncluded}`}
        </Text>

        <Text style={styles.h2}>{x.summary}</Text>
        <Row cells={[{ text: x.indicator, flex: 2 }, { text: x.amount, right: true }]} rowStyle="headerRow" />
        <Row cells={[{ text: t.grossRevenue, flex: 2 }, { text: money(s.grossRevenue), right: true }]} rowStyle="row" />
        <Row cells={[{ text: t.netRevenue, flex: 2 }, { text: money(s.netRevenue), right: true }]} rowStyle="row" />
        <Row cells={[{ text: t.fees, flex: 2 }, { text: money(s.totalFees), right: true }]} rowStyle="row" />
        <Row cells={[{ text: t.netMovement, flex: 2 }, { text: money(s.netPayout), right: true }]} rowStyle="row" />
        {s.bankTransfers !== 0 && (
          <Row
            cells={[{ text: t.bankTransfers, flex: 2 }, { text: money(Math.abs(s.bankTransfers)), right: true }]}
            rowStyle="row"
          />
        )}
        {s.cogs !== 0 && (
          <>
            <Row cells={[{ text: t.cogs, flex: 2 }, { text: money(s.cogs), right: true }]} rowStyle="row" />
            <Row
              cells={[{ text: t.grossMargin, flex: 2 }, { text: money(s.grossMargin), right: true }]}
              rowStyle="row"
            />
          </>
        )}
        <Row cells={[{ text: t.vatFr, flex: 2 }, { text: money(s.vatCollectedFr), right: true }]} rowStyle="row" />
        <Row cells={[{ text: t.vatOss, flex: 2 }, { text: money(s.vatOss), right: true }]} rowStyle="row" />
        {s.feesReverseChargeVatDue !== 0 && (
          <Row
            cells={[
              { text: t.feesReverseChargeVat, flex: 2 },
              { text: money(s.feesReverseChargeVatDue), right: true },
            ]}
            rowStyle="row"
          />
        )}
        {s.sourcingDeductibleVat !== 0 && (
          <Row
            cells={[
              { text: t.sourcingDeductibleVat, flex: 2 },
              { text: money(s.sourcingDeductibleVat), right: true },
            ]}
            rowStyle="row"
          />
        )}
        {s.sourcingNonDeductibleVat !== 0 && (
          <Row
            cells={[
              { text: t.sourcingNonDeductibleVat, flex: 2 },
              { text: money(s.sourcingNonDeductibleVat), right: true },
            ]}
            rowStyle="row"
          />
        )}
        <Row
          cells={[
            { text: s.vatToPay >= 0 ? t.vatToPay : t.vatToClaim, flex: 2 },
            { text: money(Math.abs(s.vatToPay)), right: true },
          ]}
          rowStyle="boldRow"
        />

        {input.monthly && input.monthly.length > 0 && (
          <>
            <Text style={styles.h2}>{x.monthlyBreakdown}</Text>
            <Row
              cells={[
                { text: d.overview.month },
                { text: t.grossRevenue, right: true },
                { text: t.netRevenue, right: true },
                { text: t.fees, right: true },
                { text: t.vatToPay, right: true },
                ...(s.cogs !== 0 ? [{ text: t.grossMargin, right: true }] : []),
              ]}
              rowStyle="headerRow"
            />
            {input.monthly.map(({ month, summary: m }) => (
              <Row
                key={month || "undated"}
                cells={[
                  { text: monthLabel(month, locale, d.overview.undated) },
                  { text: money(m.grossRevenue), right: true },
                  { text: money(m.netRevenue), right: true },
                  { text: money(m.totalFees), right: true },
                  { text: money(m.vatToPay), right: true },
                  ...(s.cogs !== 0 ? [{ text: money(m.grossMargin), right: true }] : []),
                ]}
                rowStyle="row"
              />
            ))}
          </>
        )}

        {s.byCountry.length > 0 && (
          <>
            <Text style={styles.h2}>{t.byCountry}</Text>
            <Row
              cells={[
                { text: t.country },
                { text: t.regime, flex: 2 },
                { text: t.taxableBase, right: true },
                { text: t.vatCol, right: true },
                { text: t.txCount, right: true },
              ]}
              rowStyle="headerRow"
            />
            {s.byCountry.map((c) => (
              <Row
                key={`${c.country}-${c.regime}`}
                cells={[
                  { text: c.country },
                  { text: t.regimes[c.regime], flex: 2 },
                  { text: money(c.taxableBase), right: true },
                  { text: money(c.vatAmount), right: true },
                  { text: String(c.transactionCount), right: true },
                ]}
                rowStyle="row"
              />
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}

export async function renderVatExportPdf(input: VatExportInput, locale: Locale, d: Dict): Promise<Buffer> {
  return renderToBuffer(<VatExportDocument input={input} locale={locale} d={d} />);
}
