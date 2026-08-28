// Central design tokens. Import from here instead of hardcoding colors/fonts
// so the whole app stays consistent and easy to re-theme later.

export const colors = {
  ink: '#16213E',       // header / dark chrome
  amber: '#E8A93D',     // single accent — buttons, active states, highlights
  paper: '#F7F4EC',     // page background
  card: '#FFFFFF',      // card surfaces
  slate: '#2B3245',     // primary text
  muted: '#8A8674',     // secondary/muted text
  border: '#E4E0D4',    // hairline borders on paper bg
  success: '#639922',
  warning: '#F39C12',
  danger: '#E74C3C',
};

// react-native-web maps these font families through to CSS font-family,
// with system fallbacks for when the custom fonts aren't loaded.
export const fonts = {
  display: 'Georgia, "Iowan Old Style", serif',   // headers, course names
  body: 'system-ui, -apple-system, sans-serif',    // everything else
  mono: '"Courier New", Menlo, monospace',         // dates, due-in badges
};

export const priorityColors: Record<string, string> = {
  Low: colors.success,
  Medium: colors.warning,
  High: colors.danger,
};
