// Central design tokens. Import from here instead of hardcoding colors/fonts
// so the whole app stays consistent and easy to re-theme later.
//
// There are two palettes with identical keys. Screens never import a palette
// directly — they read the active one via `useTheme()` (context/ThemeContext),
// so they re-render with the right colors when the theme changes.

export type Scheme = 'light' | 'dark';

// Blends `hex` toward `target` by `amount` (0 = unchanged, 1 = fully target).
// tintColor/fadeColor/darkenColor are all just this with different targets.
function mixColor(hex: string, target: string, amount: number): string {
  const parse = (h: string) => {
    const num = parseInt(h.replace('#', ''), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };
  const [r, g, b] = parse(hex);
  const [tr, tg, tb] = parse(target);
  const mix = (channel: number, t: number) => Math.round(channel + (t - channel) * amount);
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(mix(r, tr))}${toHex(mix(g, tg))}${toHex(mix(b, tb))}`;
}

// Blends a hex color toward black — used to darken a color enough to read
// as text on top of that same color's pale tinted background.
// (Kept as its own formula rather than mixColor(hex, '#000000') so light-mode
// output stays bit-for-bit identical to before — float rounding can differ.)
export function darkenColor(hex: string, amount = 0.35): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (channel: number) => Math.round(channel * (1 - amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

export const lightColors = {
  paper: '#F7F4EC',     // page background
  card: '#FFFFFF',      // card surfaces
  border: '#E4E0D4',    // hairline borders on paper bg
  slate: '#2B3245',     // primary body text
  muted: '#8A8674',     // secondary/muted text
  amber: '#E8A93D',     // single accent — highlights
  success: '#639922',
  warning: '#F39C12',
  danger: '#E74C3C',

  // What used to be `ink` (#16213E), split by job so dark mode can differ:
  text: '#16213E',      // strong foreground (e.g. "today" outlines)
  headerBg: '#16213E',  // nav header, modal headers, auth card header
  headerText: '#F7F4EC', // text/icons on headerBg
  tabBarBg: '#FFFFFF',
  tabActive: '#16213E', // active tab icon/label
  primary: '#16213E',   // solid action buttons, active pills, FABs
  onPrimary: '#F7F4EC', // text on primary
  onAccent: '#16213E',  // dark text on amber

  // Home stat cards
  statNavy: '#16213E',
  statAmber: '#E8A93D',
  statRed: '#E74C3C',
  statGreen: '#639922',

  // Status callouts/badges
  warningBg: '#FAEEDA',
  warningText: '#854F0B',
  dangerBg: '#FCEBEB',
  dangerBgStrong: darkenColor('#FCEBEB', 0.15),
  dangerIcon: darkenColor('#E74C3C', 0.25),
  infoBg: '#E6F1FB',
  infoText: '#185FA5',

  // Form fields (DatePickerField)
  fieldBg: '#FAFAFA',
  fieldBorder: '#DDDDDD',
  fieldLabel: '#555555',
  fieldText: '#333333',
  inputText: '#000000', // web text input — matches the browser default
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  paper: '#0E1424',
  card: '#1A2340',
  border: '#2A3350',
  slate: '#C9CFE4',
  muted: '#8F96AD',
  amber: '#E8A93D',
  success: '#639922',
  warning: '#F39C12',
  danger: '#E74C3C',

  text: '#F7F4EC',
  headerBg: '#16213E',
  headerText: '#F7F4EC',
  tabBarBg: '#16213E',
  tabActive: '#E8A93D',
  // Lighter navy than headerBg so buttons stand out on the dark card,
  // while existing white (#FFF) text on active pills stays readable.
  primary: '#2B3A66',
  onPrimary: '#F7F4EC',
  onAccent: '#16213E',

  statNavy: '#2B3A66',
  statAmber: '#B37D1E',
  statRed: '#A33A32',
  statGreen: '#3F7A2C',

  warningBg: '#3A2E17',
  warningText: '#F0C47A',
  dangerBg: '#3A1A1F',
  dangerBgStrong: '#4A2128',
  dangerIcon: '#F08A7E',
  infoBg: '#172B4A',
  infoText: '#8DBDF0',

  fieldBg: '#141B30',
  fieldBorder: '#2A3350',
  fieldLabel: '#C9CFE4',
  fieldText: '#F7F4EC',
  inputText: '#F7F4EC',
};

// react-native-web maps these font families through to CSS font-family,
// with system fallbacks for when the custom fonts aren't loaded.
export const fonts = {
  display: 'Georgia, "Iowan Old Style", serif',   // headers, course names
  body: 'system-ui, -apple-system, sans-serif',    // everything else
  mono: '"Courier New", Menlo, monospace',         // dates, due-in badges
};

// Same in both themes, so this can stay a static constant.
export const priorityColors: Record<string, string> = {
  Low: lightColors.success,
  Medium: lightColors.warning,
  High: lightColors.danger,
};

// De-emphasizes completed assignments on the calendar while keeping them
// identifiable by course. Light: blend toward white. Dark: blend toward the
// card color, so completed items recede into the surface instead of glowing.
export function fadeColor(hex: string, scheme: Scheme): string {
  return scheme === 'dark'
    ? mixColor(hex, darkColors.card, 0.55)
    : mixColor(hex, '#FFFFFF', 0.7);
}

// A soft background tinted by a course color (rows, callouts). Light: a pale
// tint (85% white). Dark: a dark tint (83% toward the dark page color).
export function tintColor(hex: string, scheme: Scheme): string {
  return scheme === 'dark'
    ? mixColor(hex, darkColors.paper, 0.83)
    : mixColor(hex, '#FFFFFF', 0.85);
}

// Readable text color for content sitting on tintColor(hex). Light: a darker
// shade of the course color. Dark: a light pastel of it (dark text on a dark
// tint would be unreadable).
export function tintTextColor(hex: string, scheme: Scheme): string {
  return scheme === 'dark'
    ? mixColor(hex, '#F7F4EC', 0.6)
    : darkenColor(hex, 0.35);
}
