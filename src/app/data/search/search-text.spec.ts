import { foldForSearch, toFtsMatch } from './search-text';

describe('foldForSearch', () => {
  it('lowercases and strips diacritics', () => {
    expect(foldForSearch('Mädchen Café ÖSTERREICH')).toBe('madchen cafe osterreich');
  });

  it('writes ß as ss', () => {
    expect(foldForSearch('Straße')).toBe('strasse');
  });

  it('reads a gendered word as one word', () => {
    expect(foldForSearch('Rebell*innen')).toBe('rebellinnen');
    expect(foldForSearch('Mädchen:treff')).toBe('madchentreff');
    expect(foldForSearch('Schüler_innen')).toBe('schulerinnen');
  });

  it('turns punctuation into spaces, so the parts of a hyphenated word still match', () => {
    expect(foldForSearch('Queer-Treffs, Frauen*- und Mädchen*beratung!')).toBe(
      'queer treffs frauen und madchenberatung',
    );
  });

  it('keeps digits, so a phone number can be found', () => {
    expect(foldForSearch('Notruf 147')).toBe('notruf 147');
  });
});

describe('toFtsMatch', () => {
  it('requires every term, each as a string literal', () => {
    expect(toFtsMatch('Frauen Tirol')).toBe('"frauen" AND "tirol"');
  });

  it('folds the query the way the index is folded', () => {
    expect(toFtsMatch('Rebell*innen')).toBe('"rebellinnen"');
    expect(toFtsMatch('MÄDCHEN')).toBe('"madchen"');
  });

  it('drops terms too short for the trigram index', () => {
    expect(toFtsMatch('in wien')).toBe('"wien"');
  });

  it('is null when no term is long enough', () => {
    expect(toFtsMatch('')).toBeNull();
    expect(toFtsMatch('  ab ')).toBeNull();
  });

  it('never lets query syntax through', () => {
    expect(toFtsMatch('beratung" OR "x* NEAR(a b)')).toBe('"beratung" AND "near"');
  });
});
