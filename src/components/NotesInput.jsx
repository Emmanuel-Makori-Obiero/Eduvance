import { useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth/mammoth.browser";
import JSZip from "jszip";
import { pipeline } from "@huggingface/transformers";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// The Whisper model is loaded once and reused for every audio file in
// this session (loading it is the slow part — actual transcription is
// fast once it's warm).
let asrPipelinePromise = null;
function getAsrPipeline(onProgress) {
  if (!asrPipelinePromise) {
    asrPipelinePromise = pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
      { progress_callback: onProgress },
    );
  }
  return asrPipelinePromise;
}

// Decodes any browser-playable audio file into mono 16kHz PCM, which is
// what the Whisper model expects as input.
async function decodeAudioToMono16k(file) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass({ sampleRate: 16000 });
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  let channelData;
  if (decoded.numberOfChannels > 1) {
    const ch0 = decoded.getChannelData(0);
    const ch1 = decoded.getChannelData(1);
    channelData = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) {
      channelData[i] = (ch0[i] + ch1[i]) / 2;
    }
  } else {
    channelData = decoded.getChannelData(0);
  }

  await audioCtx.close();
  return channelData;
}

// Lets a student either paste raw notes, or upload their notes as a file:
// .txt / .md (read directly), .pdf (text extracted page by page), .docx
// (text extracted via mammoth), .pptx (text extracted via jszip), a
// photo of handwritten/printed notes (OCR'd with tesseract.js), or a
// voice recording / lecture audio (transcribed with an in-browser
// Whisper model). The extracted text is handed back via onChange so the
// parent can send it to the backend as the "notes" field, which the
// prompts on the backend treat as the source of truth for lessons/games.
//
// Everything runs client-side -- no file is ever uploaded to a server
// for extraction. OCR, transcription, and the PDF worker script need an
// internet connection the first time they run (to fetch their models),
// then are cached.
export default function NotesInput({ notes, onChange }) {
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [busyStatus, setBusyStatus] = useState(""); // "" | "reading pdf" | "reading docx" | "loading" | "recognizing"
  const [busyProgress, setBusyProgress] = useState(0);
  const fileInputRef = useRef(null);

  const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/bmp"];
  const AUDIO_EXTENSIONS = [
    ".mp3",
    ".wav",
    ".m4a",
    ".ogg",
    ".webm",
    ".aac",
    ".flac",
  ];

  // The backend only ever uses the first ~6000 characters of notes in its
  // prompts anyway, but without a client-side cap, extracting text from a
  // large file (e.g. a big PDF or long audio recording) can produce
  // hundreds of KB to several MB of text. Sending all of that in the
  // request body can crash a low-memory backend instance (e.g. Render's
  // free tier) before it ever gets to truncate it server-side — which
  // shows up as a confusing 502 / "AI didn't return a playable level"
  // error. Cap it here, generously, well before it becomes a problem.
  const MAX_NOTES_CHARS = 20000;

  function appendNotes(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const combined = notes.trim() ? `${notes.trim()}\n\n${trimmed}` : trimmed;
    if (combined.length > MAX_NOTES_CHARS) {
      onChange(
        combined.slice(0, MAX_NOTES_CHARS) +
          "\n...[trimmed - only the first part of this is used]",
      );
      setFileError(
        "That file added a lot of text, so it's been trimmed to keep things fast and reliable. The lesson/game will be based on the trimmed version.",
      );
    } else {
      onChange(combined);
    }
  }

  async function handlePdf(file) {
    setFileError("");
    setBusyStatus("reading pdf");
    setBusyProgress(0);
    try {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pageTexts = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        pageTexts.push(pageText);
        setBusyProgress(Math.round((i / pdf.numPages) * 100));
      }
      const fullText = pageTexts.join("\n\n").trim();
      if (!fullText) {
        setFileError(
          "Couldn't find any selectable text in that PDF -- if it's a scan of a page, try uploading it as a photo instead.",
        );
      } else {
        appendNotes(fullText);
        setFileName(file.name);
      }
    } catch (err) {
      console.error("PDF read error:", err);
      setFileError("Couldn't read that PDF. Try pasting the text instead.");
    } finally {
      setBusyStatus("");
      setBusyProgress(0);
    }
  }

  async function handleDocx(file) {
    setFileError("");
    setBusyStatus("reading docx");
    setBusyProgress(0);
    try {
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      const text = (result.value || "").trim();
      if (!text) {
        setFileError("Couldn't find any text in that Word document.");
      } else {
        appendNotes(text);
        setFileName(file.name);
      }
    } catch (err) {
      console.error("DOCX read error:", err);
      setFileError(
        "Couldn't read that Word document. Try pasting the text instead.",
      );
    } finally {
      setBusyStatus("");
      setBusyProgress(0);
    }
  }

  async function handlePptx(file) {
    setFileError("");
    setBusyStatus("reading pptx");
    setBusyProgress(0);
    try {
      const zip = await JSZip.loadAsync(file);

      // Slide XML files live at ppt/slides/slide1.xml, slide2.xml, ... —
      // sort numerically so slides come out in the right order.
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml$/)[1], 10);
          const numB = parseInt(b.match(/slide(\d+)\.xml$/)[1], 10);
          return numA - numB;
        });

      if (slideFiles.length === 0) {
        setFileError("Couldn't find any slides in that file.");
        return;
      }

      const parser = new DOMParser();
      const slideTexts = [];

      for (let i = 0; i < slideFiles.length; i++) {
        const xml = await zip.files[slideFiles[i]].async("text");
        const doc = parser.parseFromString(xml, "application/xml");
        // Text runs in PPTX live in <a:t> elements.
        const textNodes = Array.from(doc.getElementsByTagName("a:t"));
        const slideText = textNodes
          .map((node) => node.textContent)
          .join(" ")
          .trim();
        if (slideText) {
          slideTexts.push(`Slide ${i + 1}: ${slideText}`);
        }
        setBusyProgress(Math.round(((i + 1) / slideFiles.length) * 100));
      }

      const fullText = slideTexts.join("\n\n").trim();
      if (!fullText) {
        setFileError(
          "Couldn't find any text on those slides -- if they're mostly images, try uploading a photo of the slide instead.",
        );
      } else {
        appendNotes(fullText);
        setFileName(file.name);
      }
    } catch (err) {
      console.error("PPTX read error:", err);
      setFileError(
        "Couldn't read that PowerPoint file. Try pasting the text instead.",
      );
    } finally {
      setBusyStatus("");
      setBusyProgress(0);
    }
  }

  async function handleAudio(file) {
    setFileError("");
    setBusyStatus("loading transcriber");
    setBusyProgress(0);
    try {
      const transcriber = await getAsrPipeline((progress) => {
        if (progress?.status === "progress" && progress.total) {
          setBusyProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      });

      setBusyStatus("transcribing");
      setBusyProgress(0);
      const channelData = await decodeAudioToMono16k(file);
      const output = await transcriber(channelData, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });

      const text = (output?.text || "").trim();
      if (!text) {
        setFileError(
          "Couldn't make out any speech in that recording -- try a clearer recording.",
        );
      } else {
        appendNotes(text);
        setFileName(file.name);
      }
    } catch (err) {
      console.error("Audio transcription error:", err);
      setFileError(
        "Couldn't transcribe that recording (needs an internet connection the first time). Try again or paste the text instead.",
      );
    } finally {
      setBusyStatus("");
      setBusyProgress(0);
    }
  }

  async function handleImage(file) {
    setFileError("");
    setBusyStatus("loading");
    setBusyProgress(0);
    try {
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setBusyStatus("recognizing");
            setBusyProgress(Math.round((m.progress || 0) * 100));
          }
        },
      });
      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      if (!text || !text.trim()) {
        setFileError(
          "Couldn't read any text in that photo -- try a clearer, well-lit shot.",
        );
      } else {
        appendNotes(text);
        setFileName(file.name);
      }
    } catch (err) {
      console.error("OCR error:", err);
      setFileError(
        "Couldn't scan that photo (needs an internet connection the first time). Try again or paste the text instead.",
      );
    } finally {
      setBusyStatus("");
      setBusyProgress(0);
    }
  }

  function handleFile(file) {
    setFileError("");
    if (!file) return;

    const lower = file.name.toLowerCase();
    const isImageFile = IMAGE_TYPES.includes(file.type);
    const isAudioFile =
      file.type.startsWith("audio/") ||
      AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));

    if (isImageFile) return handleImage(file);
    if (isAudioFile) return handleAudio(file);
    if (lower.endsWith(".pdf")) return handlePdf(file);
    if (lower.endsWith(".docx")) return handleDocx(file);
    if (lower.endsWith(".pptx")) return handlePptx(file);

    if (
      lower.endsWith(".txt") ||
      lower.endsWith(".md") ||
      lower.endsWith(".markdown")
    ) {
      const reader = new FileReader();
      reader.onload = (e) => {
        appendNotes(String(e.target.result || ""));
        setFileName(file.name);
      };
      reader.onerror = () => {
        setFileError("Couldn't read that file. Try pasting the text instead.");
      };
      reader.readAsText(file);
      return;
    }

    if (lower.endsWith(".doc") || lower.endsWith(".ppt")) {
      const modern = lower.endsWith(".doc") ? ".docx" : ".pptx";
      setFileError(
        `Old ${lower.slice(lower.lastIndexOf("."))} files aren't supported -- re-save it as ${modern}, or paste the text below.`,
      );
      return;
    }

    setFileError(
      "That file type isn't supported. Try .txt, .md, .pdf, .docx, .pptx, a photo (png/jpg/webp), or an audio recording (mp3/wav/m4a).",
    );
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  }

  function clearNotes() {
    onChange("");
    setFileName("");
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isBusy = busyStatus !== "";

  const busyLabel = {
    "reading pdf": `Reading PDF... ${busyProgress}%`,
    "reading docx": "Reading Word document...",
    "reading pptx": `Reading slides... ${busyProgress}%`,
    loading: "Loading scanner...",
    recognizing: `Reading photo... ${busyProgress}%`,
    "loading transcriber": busyProgress
      ? `Loading transcriber... ${busyProgress}%`
      : "Loading transcriber...",
    transcribing: "Transcribing audio...",
  }[busyStatus];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] tracking-widest text-muted dark:text-muted-dark uppercase">
          Your notes (optional)
        </p>
        {notes.trim() && (
          <button
            onClick={clearNotes}
            className="font-mono text-[10px] tracking-wide text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark uppercase"
          >
            Clear
          </button>
        )}
      </div>

      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder="Paste your notes here, or drop a .txt/.md/.pdf/.docx/.pptx file, a photo, or an audio recording of your notes below -- the lesson, quiz, and games will be built only from this."
        rows={6}
        className="w-full bg-transparent border border-line dark:border-line-dark rounded-lg px-3 py-2 text-sm text-ink dark:text-ink-dark placeholder:text-muted dark:placeholder:text-muted-dark focus:outline-none focus:border-ink dark:focus:border-ink-dark transition-colors resize-y"
      />

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="font-mono text-xs uppercase tracking-wide text-ink dark:text-ink-dark border-b border-ink dark:border-ink-dark px-1 disabled:opacity-50"
        >
          Upload file, photo, or audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,.pdf,.docx,.pptx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg,image/webp,image/bmp,audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {fileName && !isBusy && (
          <span className="text-xs text-muted dark:text-muted-dark truncate">
            {fileName}
          </span>
        )}
        {isBusy && (
          <span className="text-xs text-muted dark:text-muted-dark">
            {busyLabel}
          </span>
        )}
      </div>

      {fileError && <p className="text-xs text-incorrect mt-2">{fileError}</p>}
    </div>
  );
}
