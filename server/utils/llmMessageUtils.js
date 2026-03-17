export function normalizeMessageText(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (typeof item?.text === 'string') {
          return item.text;
        }

        return '';
      })
      .join('\n')
      .trim();
  }

  if (typeof content?.text === 'string') {
    return content.text.trim();
  }

  return '';
}

export function stripThinking(text) {
  if (!text) {
    return '';
  }

  const withoutBlocks = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '');

  if (!withoutBlocks.includes('</think>')) {
    return withoutBlocks.trim();
  }

  return withoutBlocks.split('</think>').pop().trim();
}

export function normalizeMessages(messages) {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) {
      return message;
    }

    return {
      role: message.role,
      content: normalizeMessageText(message.content),
    };
  });
}
