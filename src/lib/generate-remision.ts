// src/lib/generate-remision.ts
// Client-side PDF generation for movement receipts (remisiones)

import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  ENTRY:    "Entrada",
  EXIT:     "Salida",
  TRANSFER: "Transferencia",
  RETURN:   "Devolución",
};

export interface RemisionItem {
  productName: string;
  sku?: string | null;
  unit: string;
  quantity: number;
  fromWarehouse?: string | null;
  toWarehouse?: string | null;
}

export interface RemisionData {
  folio: string;
  type: string;
  createdAt: Date | string;
  items: RemisionItem[];
  reason?: string | null;
  notes?: string | null;
  receiverName?: string | null;
  trackingNumber?: string | null;
  createdByName: string;
  warehouseName?: string | null;
}

export function generateRemision(data: RemisionData): void {
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });

  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  const typeLabel = TYPE_LABELS[data.type] ?? data.type;
  const isExit = data.type === "EXIT";
  const dateStr = format(new Date(data.createdAt), "dd 'de' MMMM 'de' yyyy · HH:mm", { locale: es });

  // ─── Header band — Mercado Pago Yellow #FFE600 ─────────────────────
  doc.setFillColor(255, 230, 0); // Mercado Pago Yellow
  doc.rect(0, 0, W, 28, "F");

  // Dark blue text on yellow band (#2D3277)
  doc.setTextColor(45, 50, 119);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("REMISIÓN DE MOVIMIENTO", margin, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Mercado Pago — Sistema de Inventarios`, margin, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const folioText = `Folio: ${data.folio}`;
  doc.text(folioText, W - margin - doc.getTextWidth(folioText), 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, W - margin - dateW, 20);

  y = 38;
  doc.setTextColor(30, 30, 30);

  // ─── Type badge ────────────────────────────────────────────────────
  const badgeColors: Record<string, [number, number, number]> = {
    ENTRY:    [0, 166, 80],     // MP Green #00A650
    EXIT:     [239, 68, 68],    // red
    TRANSFER: [45, 50, 119],    // MP Dark Blue #2D3277
    RETURN:   [245, 158, 11],   // amber
  };
  const [br, bg, bb] = badgeColors[data.type] ?? [100, 100, 100];
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(margin, y - 4, 34, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(typeLabel.toUpperCase(), margin + 3, y + 1.5);
  doc.setTextColor(30, 30, 30);

  y += 12;

  // ─── Info grid ─────────────────────────────────────────────────────
  const col1 = margin;
  const col2 = W / 2 + 4;
  const lineH = 7;

  const infoRows: { label: string; value: string }[] = [
    { label: "Registrado por", value: data.createdByName },
    { label: "Fecha y hora", value: dateStr },
  ];
  if (data.warehouseName) infoRows.push({ label: "Almacén", value: data.warehouseName });
  if (data.reason) infoRows.push({ label: "Motivo", value: data.reason });
  if (isExit && data.receiverName) infoRows.push({ label: "Recibe", value: data.receiverName });
  if (data.notes) infoRows.push({ label: "Notas", value: data.notes });
  if (data.trackingNumber) infoRows.push({ label: "Guía", value: data.trackingNumber });

  const halfLen = Math.ceil(infoRows.length / 2);
  const leftRows = infoRows.slice(0, halfLen);
  const rightRows = infoRows.slice(halfLen);

  const maxRows = Math.max(leftRows.length, rightRows.length);

  for (let i = 0; i < maxRows; i++) {
    const rowY = y + i * lineH;
    if (leftRows[i]) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 140);
      doc.text(leftRows[i].label.toUpperCase(), col1, rowY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(leftRows[i].value, col1, rowY + 4);
    }
    if (rightRows[i]) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 140);
      doc.text(rightRows[i].label.toUpperCase(), col2, rowY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(rightRows[i].value, col2, rowY + 4);
    }
  }

  y += maxRows * lineH + 8;

  // ─── Divider ───────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 215);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ─── Table header ──────────────────────────────────────────────────
  const colWidths = { product: 80, sku: 30, from: 32, to: 32, qty: 18 };
  const tableX = margin;

  doc.setFillColor(245, 245, 250);
  doc.rect(tableX, y - 4, W - margin * 2, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 130);

  let cx = tableX + 2;
  doc.text("PRODUCTO", cx, y + 1); cx += colWidths.product;
  doc.text("SKU", cx, y + 1); cx += colWidths.sku;
  doc.text("ORIGEN", cx, y + 1); cx += colWidths.from;
  doc.text("DESTINO", cx, y + 1); cx += colWidths.to;
  doc.text("CANT.", cx, y + 1);

  y += 8;

  // ─── Table rows ────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);

  data.items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 254);
      doc.rect(tableX, y - 4.5, W - margin * 2, 7, "F");
    }

    cx = tableX + 2;
    const maxProductW = colWidths.product - 4;
    const productLines = doc.splitTextToSize(item.productName, maxProductW);
    doc.text(productLines[0], cx, y); cx += colWidths.product;
    doc.setTextColor(120, 120, 140);
    doc.setFontSize(8);
    doc.text(item.sku ?? "—", cx, y); cx += colWidths.sku;
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(item.fromWarehouse ?? "—", cx, y); cx += colWidths.from;
    doc.text(item.toWarehouse ?? "—", cx, y); cx += colWidths.to;
    doc.setFont("helvetica", "bold");
    doc.text(`${item.quantity} ${item.unit}`, cx, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);

    y += 7;
  });

  // ─── Footer divider ────────────────────────────────────────────────
  y += 4;
  doc.setDrawColor(200, 200, 215);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ─── Signature section (exits only) ────────────────────────────────
  if (isExit) {
    const sigY = y + 18;
    const midX = W / 2;

    doc.setDrawColor(100, 100, 130);
    doc.setLineWidth(0.5);
    doc.line(margin + 10, sigY, midX - 10, sigY);
    doc.line(midX + 10, sigY, W - margin - 10, sigY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 130);
    doc.text("Entrega", margin + 10, sigY + 4);
    doc.text("Recibe", midX + 10, sigY + 4);

    if (data.receiverName) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(data.receiverName, midX + 10, sigY - 5);
    }

    y = sigY + 12;
  }

  // ─── Footer note ───────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 175);
  doc.text(
    "Documento generado automáticamente por el Sistema de Inventarios Mercado Pago",
    W / 2,
    pageH - 10,
    { align: "center" }
  );

  const filename = `remision_${data.folio}_${format(new Date(data.createdAt), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(filename);
}
