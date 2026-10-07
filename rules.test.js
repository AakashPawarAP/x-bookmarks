// node rules.test.js  -> fails loudly if the categorizer breaks
const assert = require('assert');
const { categorizeAll, decode } = require('./rules.js');
const mk = (id, handle, text, media = []) => ({ id, handle, text, media, urls: [] });
const list = [
  mk('1', 'trader', 'Nifty breakout setup for tomorrow'), mk('2', 'trader', 'Swing trading rules'), mk('3', 'trader', 'stop loss is key'),
  mk('4', 'trader', 'Bank nifty options chain'), mk('5', 'trader', 'Intraday P&amp;L today'), mk('6', 'trader', 'Thanks everyone!'),
  mk('7', 'dev', 'Claude Code + MCP is wild'), mk('8', 'rando', 'when the build passes', ['img']), mk('9', 'rando', 'hello world'),
];
const c = categorizeAll(list);
assert.equal(c['1'], 'Trading'); assert.equal(c['5'], 'Trading');
assert.equal(c['6'], 'Trading', 'author majority fills unmatched posts');
assert.equal(c['7'], 'AI'); assert.equal(c['8'], 'Meme'); assert.equal(c['9'], 'Other');
assert.equal(decode('a &amp; b &lt;3'), 'a & b <3');
console.log('rules ok');
