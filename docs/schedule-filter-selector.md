# Schedule filter selector

The homepage now has three fixed controls: programme, city, and cinema. Each opens a bounded searchable selector, applies one choice, and closes. Cinema names include their city; venues with upcoming screenings in the selected programme appear first. Choosing a programme clears city/cinema filters, choosing a city clears the cinema filter, and Reset restores all three. The website supports Escape, arrow-key option navigation, and focus return to the trigger. Other routes retain their existing programme navigation.

Both website and mini-program time axes start at the previous half-hour boundary at least 30 minutes before the earliest screening (clamped to midnight), leaving 30–59 minutes of lead-in. Current clock time does not expand the axis. A 14:00 first screening begins on a 13:30 axis.

Validation: `tools/check-golden-rooster.js` checks mini-program selection/search/reset, city filtering, time-axis lead-in, and a 20-programme catalogue on both implementations. Browser checks covered 390px mobile and 1280px desktop, Chinese/English, searchable cinema and programme lists, city selection, keyboard navigation/Escape, automatic closing, and horizontal overflow. Film details and personal-plan routes were checked for display regressions. Film data, screening keys, and personal storage keys are unchanged.

Mini-program source is synchronized in the same change. Native layout still requires verification and release in WeChat Developer Tools; publishing GitHub Pages does not publish a mini-program client update.
