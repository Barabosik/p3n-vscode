// Test texts and canned API answers, shared by the unit and integration tests. The same runs the browser
// extension's and the Word add-in's mocked tests use.
const AI_TEXT = "In today's fast-paced world, it's worth noting that effective communication is more important than ever. Moreover, leveraging the right tools can help teams unlock their full potential and navigate the complexities of modern work.";
const SHORT = 'Ultimately, this seamless transition unlocks a rich tapestry of possibilities for teams of all sizes, empowering everyone to thrive in an ever-evolving landscape.';

const FIXTURES = {
  detect: { id: 'mock-detect', skill: 'detect', status: 'succeeded', cached: false, error: null, charged_usd: '0',
    output: { version: 'detect-v1.2', ai: 0.96, label: 'ai', verdict: 'Generic filler phrases with no specific claim or example.', confidence: { level: 'medium', reason: 'Two short sentences.' },
      sentences: [{ text: AI_TEXT.split('. ')[0] + '.', why: 'A stock opening with a vague claim.' }],
      examples: [
        { sentence: AI_TEXT.split('. ')[0] + '.', rules: [{ name: 'Stock opener' }] },
        { sentence: AI_TEXT.split('. ')[1], rules: [{ name: 'Filler verb (LLM)' }, { name: 'Abstract benefit' }] },
      ] } },
  humanize: { id: 'mock-humanize', skill: 'humanize', status: 'succeeded', cached: false, error: null, charged_usd: '0',
    // The live API ends the rewrite with a line break; Replace must not carry it into the editor.
    output: { version: 'humanize-v1.3', model: 'haiku', text: 'This transition helps teams of all sizes.\n', ai_before: 0.95, ai_after: 0.01, label_after: 'human', passes: true, invented_blocked: [] } },
  me: { email: 'test@example.com', balance_usd: '4.5', key: { name: 'laptop', prefix: 'p3n_good' } },
};

// The rewrite headline says "No longer" or "Still" only when the detector model put the text sent in the AI
// class (ai_before >= 0.5). It can score text at 0% that Check called likely AI.
const HEADLINES = [
  [{ ai_before: 0.95, ai_after: 0.01, passes: true }, 'No longer reads as AI'],
  [{ ai_before: 0.08, ai_after: 0.02, passes: true }, "Doesn't read as AI"],
  [{ ai_before: 0.88, ai_after: 0.71, passes: false, label_after: 'ai' }, 'Still reads as AI'],
  [{ ai_before: 0.3, ai_after: 0.62, passes: false, label_after: 'ai' }, 'Reads as AI'],
  [{ ai_before: null, ai_after: 0.04, passes: true }, "Doesn't read as AI"],
];

module.exports = { AI_TEXT, SHORT, FIXTURES, HEADLINES };
