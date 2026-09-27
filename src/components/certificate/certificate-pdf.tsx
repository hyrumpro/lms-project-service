import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/** A4-landscape diploma (legacy certificate addon parity — downloadable PDF). */
const A = "#754ffe"; // legacy primary purple
const INK = "#1e293b";
const SUN = "#fe954f";

const styles = StyleSheet.create({
  page: {
    flexDirection: "row",
    backgroundColor: "#fffdf9",
    padding: 28,
    fontFamily: "Helvetica",
  },
  outer: { flex: 1, borderWidth: 6, borderColor: A, padding: 8 },
  inner: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: A,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 60,
  },
  brand: { fontSize: 10, color: "#8a8f98", letterSpacing: 3, marginBottom: 26 },
  title: { fontSize: 34, color: INK, marginBottom: 6 },
  titleSub: { fontSize: 12, color: "#6e798a", marginTop: 18, marginBottom: 6 },
  name: { fontSize: 40, color: INK, fontStyle: "italic", fontWeight: 700, marginTop: 4 },
  courseLabel: { fontSize: 11, color: "#6e798a", marginTop: 26, marginBottom: 6 },
  course: { fontSize: 22, color: INK, textAlign: "center" },
  footerRow: {
    position: "absolute",
    bottom: 44,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  small: { fontSize: 9, color: "#8a8f98", letterSpacing: 1 },
  smallValue: { fontSize: 12, color: INK, marginTop: 4 },
  seal: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: A,
    backgroundColor: SUN,
    alignItems: "center",
    justifyContent: "center",
  },
  sealText: { fontSize: 9, color: "#1e293b", fontWeight: 700 },
  verify: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: "#8a8f98",
  },
});

export function CertificatePdf({
  studentName,
  courseTitle,
  code,
  issuedAt,
  verifyUrl,
  qrDataUrl,
}: {
  studentName: string;
  courseTitle: string;
  code: string;
  issuedAt: string;
  verifyUrl: string;
  qrDataUrl?: string;
}) {
  return (
    <Document title={`Certificate ${code} — Academy LMS`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.outer}>
          <View style={styles.inner}>
            <Text style={styles.brand}>ACADEMY LMS · OFFICIAL RECORD</Text>
            <Text style={styles.title}>Certificate of Completion</Text>
            <Text style={styles.titleSub}>This certifies that</Text>
            <Text style={styles.name}>{studentName}</Text>
            <Text style={styles.courseLabel}>has successfully completed the course</Text>
            <Text style={styles.course}>{courseTitle}</Text>
            <View style={styles.footerRow}>
              <View>
                <Text style={styles.small}>CREDENTIAL ID</Text>
                <Text style={styles.smallValue}>{code}</Text>
              </View>
              <View style={styles.seal}>
                <Text style={styles.sealText}>VERIFIED</Text>
              </View>
              {qrDataUrl ? <Image src={qrDataUrl} style={{ width: 72, height: 72 }} /> : null}
              <View>
                <Text style={styles.small}>ISSUED</Text>
                <Text style={styles.smallValue}>{issuedAt}</Text>
              </View>
            </View>
            <Text style={styles.verify} fixed>
              Verify this credential at {verifyUrl}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
