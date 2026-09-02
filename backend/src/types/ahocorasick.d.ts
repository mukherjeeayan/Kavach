declare module 'ahocorasick' {
  class AhoCorasick {
    constructor(patterns: string[]);
    search(text: string): [number, string[]][];
  }
  export default AhoCorasick;
}
