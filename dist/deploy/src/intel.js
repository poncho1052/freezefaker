// Progressive outfit intel ("Where's Wally" style): an ordered set of clues
// about a character's appearance, revealed over time. Used by the WANTED card
// (you are the Watcher) and the THEY-KNOW exposure meter (you are a Faker).

const COLOR_NAMES = {
  '#2b3550': ['navy', 'ネイビー'], '#4a4f57': ['charcoal', 'チャコール'],
  '#6e5844': ['brown', 'ブラウン'], '#c9bc9c': ['beige', 'ベージュ'],
  '#6b6b3a': ['olive', 'オリーブ'], '#5a7355': ['green', 'グリーン'],
  '#7c93a8': ['dusty blue', 'くすみブルー'], '#8a8f95': ['gray', 'グレー'],
  '#7a5a56': ['clay', 'レンガ'], '#556b6e': ['teal', '青緑'],
  '#357': ['blue', 'ブルー'], '#335577': ['blue', 'ブルー'],
  '#2a2f38': ['dark gray', 'ダークグレー'], '#3a3f47': ['gray', 'グレー'],
  '#4a4033': ['khaki', 'カーキ'], '#556': ['slate', 'スレート'],
  '#40372e': ['dark brown', 'こげ茶'], '#556b6e2': ['teal', '青緑'],
  '#3a2f28': ['dark brown', 'こげ茶'],
};

export function colorName(hex, lang) {
  const e = COLOR_NAMES[hex];
  if (!e) return lang === 'ja' ? 'ダーク' : 'dark';
  return lang === 'ja' ? e[1] : e[0];
}

// Ordered clues; first `level` entries are revealed.
export function cluesFor(a) {
  return [
    { k: 'top', color: a.clothing },
    { k: 'hat', has: !!a.hat, color: a.hat },
    { k: 'bag', has: !!a.bag, color: a.bag },
    { k: 'glasses', has: !!a.glasses },
    { k: 'pants', color: a.pants },
  ];
}

export function clueText(c, t, lang) {
  const name = { top: t.clueTop, hat: t.clueHat, bag: t.clueBag, glasses: t.clueGlasses, pants: t.cluePants }[c.k];
  if (c.k === 'top' || c.k === 'pants') return `${name}: ${colorName(c.color, lang)}`;
  if (!c.has) return `${name}: ${t.clueNo}`;
  return c.color ? `${name}: ${colorName(c.color, lang)}` : `${name}: ${t.clueYes}`;
}
