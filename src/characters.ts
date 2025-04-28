/**
 * Available end-of-line (EOL) characters for different operating systems and special formatting.
 * These characters are used to terminate lines in text, with different systems historically
 * using different conventions.
 */
const EOL = {
  /** Unix/Linux/macOS style line ending */
  LF: '\n',
  /** Windows style line ending */
  CRLF: '\r\n',
  /** Classic Mac style line ending (pre-OSX) */
  CR: '\r',
  /** Vertical tab character */
  VT: '\v',
  /** Form feed character */
  FF: '\f',
} as const

/**
 * Box drawing characters for creating borders, tables, trees, and other structured layouts.
 * Includes various styles (single, double, bold) for horizontal and vertical lines, corners, and intersections.
 */
const BOX = {
  HORIZONTAL: {
    /** Single horizontal line ─ */
    SINGLE: '─',
    /** Double horizontal line ═ */
    DOUBLE: '═',
    /** Bold horizontal line ━ */
    BOLD: '━',
    /** Dashed horizontal line ┄ */
    DASHED: '┄',
    /** Dotted horizontal line ┈ */
    DOTTED: '┈',
  },
  VERTICAL: {
    /** Single vertical line │ */
    SINGLE: '│',
    /** Double vertical line ║ */
    DOUBLE: '║',
    /** Bold vertical line ┃ */
    BOLD: '┃',
    /** Dashed vertical line ┆ */
    DASHED: '┆',
    /** Dotted vertical line ┊ */
    DOTTED: '┊',
  },
  CORNER: {
    /** Top-left corner (single) ┌ */
    TOP_LEFT: '┌',
    /** Top-right corner (single) ┐ */
    TOP_RIGHT: '┐',
    /** Bottom-left corner (single) └ */
    BOTTOM_LEFT: '└',
    /** Bottom-right corner (single) ┘ */
    BOTTOM_RIGHT: '┘',
    DOUBLE: {
      /** Top-left corner (double) ╔ */
      TOP_LEFT: '╔',
      /** Top-right corner (double) ╗ */
      TOP_RIGHT: '╗',
      /** Bottom-left corner (double) ╚ */
      BOTTOM_LEFT: '╚',
      /** Bottom-right corner (double) ╝ */
      BOTTOM_RIGHT: '╝',
    },
  },
} as const

/**
 * Whitespace characters for alignment, formatting, and layout control.
 * Different space types have different widths and behaviors across terminals and fonts.
 */
const SPACE = {
  /** Standard space character ' ' */
  NORMAL: ' ',
  /** Non-breaking space (prevents line breaks) \u00A0 */
  NON_BREAKING: '\u00A0',
  /** En space (width of letter 'N') \u2002 */
  EN: '\u2002',
  /** Em space (width of letter 'M') \u2003 */
  EM: '\u2003',
  /** Thin space (narrower than normal) \u2009 */
  THIN: '\u2009',
  /** Hair space (very narrow) \u200A */
  HAIR: '\u200A',
  /** Zero-width space (invisible but allows line breaks) \u200B */
  ZERO_WIDTH: '\u200B',
  /** Ideographic space (for CJK text) \u3000 */
  IDEOGRAPHIC: '\u3000',
  /** Middle dot (centered dot used for spacing) \u00B7 */
  MIDDLE_DOT: '\u00B7',
  /** Figure space (same width as digits) \u2007 */
  FIGURE: '\u2007',
  /** Tab character \t */
  TAB: '\t',
} as const

/**
 * List markers for creating bulleted, numbered, and other types of lists.
 * Useful for menus, options, and hierarchical data display.
 */
const LIST = {
  BULLET: {
    /** Round bullet • */
    ROUND: '•',
    /** Square bullet ▪ */
    SQUARE: '▪',
    /** Triangle bullet ‣ */
    TRIANGLE: '‣',
    /** Diamond bullet ◆ */
    DIAMOND: '◆',
  },
  NUMBERED: {
    /** Circled numbers ①②③④⑤⑥⑦⑧⑨⑩ */
    CIRCLE: '①②③④⑤⑥⑦⑧⑨⑩',
    /** Parenthesized numbers ⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽ */
    PARENTHESIS: '⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽',
    /** Numbers with period ⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑ */
    PERIOD: '⒈⒉⒊⒋⒌⒍⒎⒏⒐⒑',
  },
  ARROW: {
    /** Right arrow → */
    RIGHT: '→',
    /** Double right arrow ⇒ */
    DOUBLE_RIGHT: '⇒',
    /** Heavy right arrow ➜ */
    HEAVY_RIGHT: '➜',
    /** Right pointer ▶ */
    POINTER: '▶',
  },
} as const

/**
 * Status indicator characters for showing success, error, warning, and progress states.
 * Useful for CLI output, logs, and user feedback.
 */
const STATUS = {
  SUCCESS: {
    /** Check mark ✓ */
    CHECK: '✓',
    /** Heavy check mark ✔ */
    HEAVY_CHECK: '✔',
    /** Filled circle ● */
    CIRCLE: '●',
    /** Filled star ★ */
    STAR: '★',
  },
  ERROR: {
    /** Cross ✕ */
    CROSS: '✕',
    /** Heavy cross ✖ */
    HEAVY_CROSS: '✖',
    /** Empty circle ○ */
    CIRCLE: '○',
    /** Exclamation mark ❗ */
    BANG: '❗',
    /** Prohibited ⛔ */
    PROHIBITED: '⛔',
    /** Heavy ballot X ✘ */
    BALLOT_X: '✘',
    /** Multiplication X ✗ */
    MULTIPLY: '✗',
    /** Banned symbol Ø */
    BANNED: 'Ø',
    /** Slashed circle ⃠ */
    SLASHED: '⃠',
    /** Square with diagonal crosshatch ⧅ */
    CROSSHATCH: '⧅',
  },
  WARNING: {
    /** Warning triangle ⚠ */
    TRIANGLE: '⚠',
    /** Double exclamation mark ‼ */
    BANG: '‼',
    /** Small star ⭑ */
    DOT: '⭑',
    /** Radioactive sign ☢ */
    RADIOACTIVE: '☢',
    /** Biohazard sign ☣ */
    BIOHAZARD: '☣',
    /** White exclamation mark ❕ */
    LIGHT_BANG: '❕',
    /** High voltage sign ⚡ */
    VOLTAGE: '⚡',
    /** Lightning ↯ */
    LIGHTNING: '↯',
    /** Skull and crossbones ☠ */
    SKULL: '☠',
    /** Warning sign ⚇ */
    CAUTION: '⚇',
    /** Warning beacon ⚠︎ */
    ALT_TRIANGLE: '⚠︎',
  },
  PROGRESS: {
    /** Dot • */
    DOT: '•',
    /** Square ▪ */
    SQUARE: '▪',
    /** Circle ○ */
    CIRCLE: '○',
    /** Diamond ◇ */
    DIAMOND: '◇',
    /** Braille spinner characters */
    SPINNER: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  },
} as const

/**
 * Quote characters for wrapping text in various styles and languages.
 */
const QUOTE = {
  SINGLE: {
    /** Left single quote */
    LEFT: '\u2018',
    /** Right single quote */
    RIGHT: '\u2019',
    /** Straight single quote */
    STRAIGHT: "'",
  },
  DOUBLE: {
    /** Left double quote */
    LEFT: '\u201C',
    /** Right double quote */
    RIGHT: '\u201D',
    /** Straight double quote */
    STRAIGHT: '"',
  },
  ANGLE: {
    SINGLE: {
      /** Left single angle quote */
      LEFT: '\u2039',
      /** Right single angle quote */
      RIGHT: '\u203A',
    },
    DOUBLE: {
      /** Left double angle quote */
      LEFT: '\u00AB',
      /** Right double angle quote */
      RIGHT: '\u00BB',
    },
  },
} as const

/**
 * Ellipsis characters for indicating truncation, continuation, or omission.
 * These can be used in text wrapping, truncation, or to indicate ongoing operations.
 */
const ELLIPSIS = {
  /** Standard horizontal ellipsis ... */
  HORIZONTAL: '...',
  /** Middle ellipsis (centered dots) ⋯ */
  MIDDLE: '⋯',
  /** Vertical ellipsis (vertical dots) ⋮ */
  VERTICAL: '⋮',
  /** Diagonal ellipsis (diagonal dots) ⋰ */
  UP_RIGHT: '⋰',
  /** Diagonal ellipsis (diagonal dots) ⋱ */
  DOWN_RIGHT: '⋱',
  /** Four dot ellipsis .... */
  FOUR_DOT: '....',
  /** Two dot leader .. */
  TWO_DOT: '..',
  /** Single dot leader . */
  ONE_DOT: '.',
} as const

/**
 * Collection of special characters and character sequences used throughout the codebase.
 * Each property represents a different category of characters (e.g., line endings, whitespace, etc.).
 */
const Characters = {
  /** End-of-Line characters for different operating systems */
  EOL,
  /** Box drawing characters for borders, tables, and trees */
  BOX,
  /** Whitespace characters for alignment and formatting */
  SPACE,
  /** List markers for creating bulleted and numbered lists */
  LIST,
  /** Status indicators for success, error, warning, and progress */
  STATUS,
  /** Quote characters for different styles and languages */
  QUOTE,
  /** Ellipsis characters for truncation and continuation */
  ELLIPSIS,
} as const

export default Characters
