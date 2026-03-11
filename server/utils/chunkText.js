export function chunkText(text, chunkSize = 1600, overlap = 160) {
  let cleaned = text.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const sentences = cleaned.match(/[^.!?]*[.!?]+\s*/g) || [cleaned];
  const trimmed = sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);

  const chunks = [];
  let index = 0;

  while (index < trimmed.length) {
    let chunk = '';
    const start = index;

    while (index < trimmed.length) {
      const next = chunk ? `${chunk} ${trimmed[index]}` : trimmed[index];
      if (chunk && next.length > chunkSize) break;
      chunk = next;
      index += 1;
    }

    if (index === start) {
      chunk = trimmed[index];
      index += 1;
    }

    chunks.push({
      text: chunk,
      index: chunks.length,
      charCount: chunk.length,
    });

    if (index < trimmed.length) {
      let tail = '';
      let rewind = index - 1;

      while (rewind >= start) {
        const candidate = tail ? `${trimmed[rewind]} ${tail}` : trimmed[rewind];
        if (candidate.length >= overlap) {
          tail = candidate;
          break;
        }
        tail = candidate;
        rewind -= 1;
      }

      if (rewind > start) {
        index = rewind;
      }
    }
  }

  if (chunks.length > 1 && chunks[chunks.length - 1].charCount <= 50) {
    chunks.pop();
  }

  return chunks;
}
