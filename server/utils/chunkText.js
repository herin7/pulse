export function chunkText(text, chunkSize = 1600, overlap = 160) {
  // Strip HTML tags
  let cleaned = text.replace(/<[^>]*>/g, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Split into sentences, keeping the delimiter attached
  const sentences = cleaned.match(/[^.!?]*[.!?]+\s*/g) || [cleaned];
  // Trim trailing whitespace from each sentence
  const trimmed = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

  const chunks = [];
  let i = 0;

  while (i < trimmed.length) {
    let chunk = '';
    const start = i;

    // Greedily accumulate sentences
    while (i < trimmed.length) {
      const next = chunk ? chunk + ' ' + trimmed[i] : trimmed[i];
      if (chunk && next.length > chunkSize) break;
      chunk = next;
      i++;
    }

    // If we didn't advance (single sentence longer than chunkSize), take it anyway
    if (i === start) {
      chunk = trimmed[i];
      i++;
    }

    chunks.push({
      text: chunk,
      index: chunks.length,
      charCount: chunk.length,
    });

    // Back up for overlap: rewind sentences so the tail of the current chunk
    // overlaps into the next
    if (i < trimmed.length) {
      let tail = '';
      let rewind = i - 1;
      while (rewind >= start) {
        const candidate = tail ? trimmed[rewind] + ' ' + tail : trimmed[rewind];
        if (candidate.length >= overlap) {
          tail = candidate;
          break;
        }
        tail = candidate;
        rewind--;
      }
      if (rewind > start) {
        i = rewind;
      }
    }
  }

  // Drop tiny trailing chunk
  if (chunks.length > 1 && chunks[chunks.length - 1].charCount <= 50) {
    chunks.pop();
  }

  return chunks;
}
