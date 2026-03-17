const CHUNK_MAX_CHARS = 1200;
const CHUNK_MIN_CHARS = 800;
const CHUNK_OVERLAP_CHARS = 100;
const SENTENCE_BOUNDARY_REGEX = /(?<=[.!?])\s+(?=[A-Z])/;

function normalizeText(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildSentenceSpans(text) {
  const sentences = text.split(SENTENCE_BOUNDARY_REGEX).map((sentence) => sentence.trim()).filter(Boolean);
  const spans = [];
  let cursor = 0;

  sentences.forEach((sentence) => {
    const start = text.indexOf(sentence, cursor);
    const end = start + sentence.length;
    cursor = end;
    spans.push({ sentence, start, end });
  });

  return spans;
}

function buildChunkMetadata(source, index, totalChunks, start, end, text) {
  return {
    index,
    totalChunks,
    source,
    charStart: start,
    charEnd: end,
    text,
  };
}

export function chunkText(text, options = {}) {
  const source = options.source || 'unknown';
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const spans = buildSentenceSpans(normalized);
  if (!spans.length) return [];

  const rawChunks = [];
  let sentenceIndex = 0;

  while (sentenceIndex < spans.length) {
    const startSentenceIndex = sentenceIndex;
    let endSentenceIndex = sentenceIndex;
    let charStart = spans[startSentenceIndex].start;
    let charEnd = spans[endSentenceIndex].end;

    while (endSentenceIndex + 1 < spans.length) {
      const candidateEnd = spans[endSentenceIndex + 1].end;
      const candidateLength = candidateEnd - charStart;
      const currentLength = charEnd - charStart;

      if (candidateLength > CHUNK_MAX_CHARS && currentLength >= CHUNK_MIN_CHARS) {
        break;
      }

      endSentenceIndex += 1;
      charEnd = candidateEnd;
    }

    rawChunks.push({ charStart, charEnd });
    sentenceIndex = endSentenceIndex + 1;

    if (sentenceIndex < spans.length) {
      let overlapStart = endSentenceIndex;
      while (overlapStart > startSentenceIndex) {
        const overlapLength = spans[endSentenceIndex].end - spans[overlapStart].start;
        if (overlapLength >= CHUNK_OVERLAP_CHARS) break;
        overlapStart -= 1;
      }

      if (overlapStart > startSentenceIndex) {
        sentenceIndex = overlapStart;
      }
    }
  }

  const chunks = rawChunks.map((chunk) => {
    const textSlice = normalized.slice(chunk.charStart, chunk.charEnd).trim();
    return {
      charEnd: chunk.charEnd,
      charStart: chunk.charStart,
      text: textSlice,
    };
  });

  const filteredChunks = chunks.filter((chunk) => chunk.text.length > 40);
  return filteredChunks.map((chunk, index) => (
    buildChunkMetadata(source, index, filteredChunks.length, chunk.charStart, chunk.charEnd, chunk.text)
  ));
}
