export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'close_loop',
      description: 'Mark an open loop as completed. Use when user confirms they did something that was an open loop.',
      parameters: {
        type: 'object',
        properties: {
          loopId: { type: 'number', description: 'The open loop ID to close' },
        },
        required: ['loopId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_competitor',
      description: 'Add a competitor to track. Use when user mentions a competitor they want to monitor.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Competitor company name' },
          url: { type: 'string', description: 'Competitor website URL (optional)' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_competitor_intel',
      description: 'Get recent competitive intelligence. Use when user asks about competitors or competitive landscape.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];
