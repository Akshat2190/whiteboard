const { Anthropic } = require('@anthropic-ai/sdk');

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });

const parseCanvasObjects = (objects) => {
  const nodes = objects
    .filter((obj) => ['rect', 'circle', 'textbox'].includes(obj.type))
    .map((obj) => ({
      id: obj.id || obj.uuid || `${obj.type}-${Math.random().toString(36).slice(2)}`,
      label: obj.text || obj.label || obj.type,
      x: obj.left || obj.x || 0,
      y: obj.top || obj.y || 0,
    }));

  const getNearestNode = (point) => {
    let nearest = null;
    let minDistance = Infinity;
    nodes.forEach((node) => {
      const dx = (node.x || 0) - (point.x || 0);
      const dy = (node.y || 0) - (point.y || 0);
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = node;
      }
    });
    return nearest;
  };

  const edges = objects
    .filter((obj) => ['line', 'arrow', 'path'].includes(obj.type) && obj.connectedFrom && obj.connectedTo)
    .map((obj) => {
      const from = getNearestNode(obj.connectedFrom || obj.from || { x: obj.x1, y: obj.y1 });
      const to = getNearestNode(obj.connectedTo || obj.to || { x: obj.x2, y: obj.y2 });
      return {
        from: from ? from.label : 'unknown',
        to: to ? to.label : 'unknown',
      };
    });

  return { nodes, edges };
};

const buildArchitecturePrompt = (nodes, edges) => {
  const componentLabels = nodes.map((node) => node.label).join(', ') || 'none';
  const dataFlows = edges.map((edge) => `${edge.from} → ${edge.to}`).join(', ') || 'none';
  return `System Architecture:\nComponents: ${componentLabels}\nData Flow: ${dataFlows}\nGenerate complete full stack boilerplate code for this architecture.`;
};

const generateCodeFromDiagram = async (objects) => {
  if (!Array.isArray(objects) || objects.length === 0) {
    throw new Error('No diagram objects provided');
  }

  const { nodes, edges } = parseCanvasObjects(objects);
  const architecturePrompt = buildArchitecturePrompt(nodes, edges);

  const response = await anthropicClient.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system:
      'You are an expert full stack developer. Generate complete working boilerplate code based on the architecture described. Return ONLY a valid JSON object with no markdown fences, no explanation text, nothing else. Exact format: { "files": [ { "filename": "string", "code": "string", "language": "string" } ] }. Use React.js for frontend, Express.js for backend, MongoDB with Mongoose for database. Make every file complete and working.',
    messages: [
      {
        role: 'user',
        content: architecturePrompt,
      },
    ],
  });

  const textResponse = response?.content?.[0]?.text || '';
  const cleaned = textResponse.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error('Failed to parse Claude response as JSON: ' + error.message);
  }

  if (!parsed || !Array.isArray(parsed.files)) {
    throw new Error('Claude response did not contain a files array');
  }

  return parsed;
};

module.exports = {
  parseCanvasObjects,
  buildArchitecturePrompt,
  generateCodeFromDiagram,
};
