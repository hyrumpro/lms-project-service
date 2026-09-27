import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { getOrderForInvoice } from "@/server/queries/commerce";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 11 },
  title: { fontSize: 20, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
});

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const data = await getOrderForInvoice(session.user.id, orderId);
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Invoice {data.order.id.slice(0, 8).toUpperCase()}</Text>
        <Text>Status: {data.order.status}</Text>
        {data.items.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text>{item.titleSnapshot}</Text>
            <Text>{(item.unitPrice / 100).toFixed(2)}</Text>
          </View>
        ))}
        <View style={styles.row}>
          <Text>Total</Text>
          <Text>{(data.order.total / 100).toFixed(2)}</Text>
        </View>
      </Page>
    </Document>,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${orderId}.pdf"`,
    },
  });
}
