// Auto-categorization. Your manual picks (categories.json) always override this.
// ponytail: keyword heuristics + author majority vote; swap for an LLM pass if "Other" stays too big.
const RULES = [
  ['Trading', /\b(trad(e|es|er|ers|ing)|nifty|bank ?nifty|sensex|stocks?|shares|swing|intraday|breakout|f&o|futures|option (buying|selling|chain)|charts?|candles?|candlestick|vcp|darvas|stop ?loss|rsi|ema|sma|vwap|nse|bse|sebi|ipo|smallcap|midcap|smlcap|portfolio|invest(ing|or|ors|ment|ments)?|mutual funds?|dividend|crypto|bitcoin|btc|forex|bullish|bearish|stock market|p&l|pnl|xirr|cagr|sip|q[1-4] ?fy\d\d)\b/i],
  ['AI', /\b(ai|llms?|gpt[- ]?[\d.o]*|chatgpt|claude|anthropic|openai|gemini|grok|copilot|cursor|agents?|agentic|mcp|rag|prompts?|prompting|fine-?tun\w*|embeddings?|transformers?|machine learning|ml|deep learning|neural|cnns?|diffusion|midjourney|hugging ?face|ollama|vibe ?cod\w*|ai models?)\b/i],
  ['Career', /\b(interviews?|resume|hiring|we'?re hiring|job|jobs|offer letter|salary|ctc|lpa|promotion|layoffs?|career|referral|internship|faang|maang|recruiter|leetcode|dsa|sde ?[1-3]?)\b/i],
  ['Coding', /\b(code|coding|programming|developers?|engineer(s|ing)?|system design|hld|lld|backend|frontend|database|sql|postgres|mysql|redis|kafka|docker|kubernetes|k8s|aws|ec2|api|apis|microservices?|javascript|typescript|react|node(js)?|python|golang|rust|java|linux|git|github|devops|algorithms?|data structures?|architecture|scalab\w+|latency|caching|open[- ]source|repos?|cli|html|css)\b/i],
  ['Business', /\b(startups?|founders?|yc|y combinator|saas|product hunt|indie ?hackers?|bootstrapp\w+|mrr|arr|revenue|marketing|copywriting|sales|customers?|fundrais\w+|vcs?|venture|side projects?|business)\b/i],
  ['Health', /\b(workout|exercises?|gym|fitness|protein|creatine|diet|fat loss|weight loss|muscles?|sleep|gut|hair|skin|yoga|meditation|cardio|calories|health|healthy|vitamin \w+|supplements?)\b/i],
  ['Trivia', /\b(did you know|fun facts?|history of|historical|ancient|origin of|world'?s (largest|first|oldest|biggest)|nasa|universe|physics|psychology|on this day|mystery)\b/i],
];

const decode = s => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function keywordCategory(b) {
  const text = `${decode(b.text)} ${(b.urls || []).join(' ')}`;
  for (const [name, re] of RULES) if (re.test(text)) return name;
  return null;
}

// Returns {id: category} for every bookmark.
function categorizeAll(list) {
  const kw = {}, byAuthor = {};
  for (const b of list) {
    const c = (kw[b.id] = keywordCategory(b));
    if (c) ((byAuthor[b.handle] ||= {})[c] = (byAuthor[b.handle][c] || 0) + 1);
  }
  // an author whose matched posts are >=60% one topic (min 5) gets that topic for their unmatched posts
  const authorCat = {};
  for (const [h, counts] of Object.entries(byAuthor)) {
    const total = Object.values(counts).reduce((a, n) => a + n, 0);
    const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (total >= 5 && n / total >= 0.6) authorCat[h] = top;
  }
  const out = {};
  for (const b of list) {
    const words = decode(b.text).replace(/https?:\/\/\S+/g, '').trim().split(/\s+/).filter(Boolean).length;
    out[b.id] = kw[b.id] || authorCat[b.handle] || ((b.media || []).length && words <= 25 ? 'Meme' : 'Other');
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { RULES, decode, keywordCategory, categorizeAll };
