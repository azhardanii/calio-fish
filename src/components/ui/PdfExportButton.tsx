'use client';

import React from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';

export function PdfExportButton({ targetId, filename = "report", className = "" }: { targetId: string, filename?: string, className?: string }) {
  const exportPDF = async () => {
    const input = document.getElementById(targetId);
    if (!input) {
      console.error('Export target not found');
      return;
    }

    try {
      const canvas = await html2canvas(input, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
    }
  };

  return (
    <Button onClick={exportPDF} variant="outline" className={`h-9 px-4 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm ${className}`}>
      Export PDF
    </Button>
  );
}
