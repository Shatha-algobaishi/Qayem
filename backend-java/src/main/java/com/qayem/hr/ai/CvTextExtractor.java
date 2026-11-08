package com.qayem.hr.ai;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;

/** Extracts raw text from CV files (PDF, DOC, DOCX) for downstream AI parsing. */
@Component
public class CvTextExtractor {

    // Kept short: on CPU-only inference, prompt length dominates latency, and a
    // CV's identifying/qualification fields are almost always in the first page.
    private static final int MAX_CHARS = 4_000;

    public String extract(InputStream in, String fileName) throws IOException {
        String ext = fileName != null && fileName.contains(".")
                ? fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
                : "";

        String text = switch (ext) {
            case ".pdf"  -> extractPdf(in);
            case ".docx" -> extractDocx(in);
            case ".doc"  -> extractDoc(in);
            default -> throw new IllegalArgumentException("Unsupported file type: " + ext);
        };

        text = text == null ? "" : text.trim();
        return text.length() > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;
    }

    private String extractPdf(InputStream in) throws IOException {
        try (PDDocument doc = PDDocument.load(in)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    private String extractDocx(InputStream in) throws IOException {
        try (XWPFDocument doc = new XWPFDocument(in); XWPFWordExtractor extractor = new XWPFWordExtractor(doc)) {
            return extractor.getText();
        }
    }

    private String extractDoc(InputStream in) throws IOException {
        try (HWPFDocument doc = new HWPFDocument(in); WordExtractor extractor = new WordExtractor(doc)) {
            return extractor.getText();
        }
    }
}
