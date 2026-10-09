import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Web-only HTML shell for every page in the static export (see CLAUDE.md
// gotcha #11). This file runs in Node during `expo export`, never in the
// browser — so it must not import the Supabase client, the theme context,
// or anything else that touches `window`.

// Make the app fill the *visible* viewport. ScrollViewStyleReset already sets
// html/body/#root to height:100%, but on iPhone Safari 100% can include the
// area behind the bottom toolbar, pushing the tab bar under it. 100dvh
// ("dynamic viewport height") tracks what's actually visible.
const viewportFill = `
html, body, #root { height: 100%; }
@supports (height: 100dvh) {
  html, body, #root { height: 100dvh; }
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover lets the page extend under the notch/home
            indicator, which makes env(safe-area-inset-*) report real values.
            react-native-safe-area-context reads those, so the tab bar pads
            for the home indicator and headers pad for the status bar. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* "Add to Home Screen" opens full-screen without Safari's UI. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Standalone mode only: draw the page under a transparent status
            bar with white icons. Safe because every header pads itself by
            the top safe-area inset, so the navy header sits behind the icons. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Disables body scrolling on web so ScrollView behaves like native. */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: viewportFill }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
