/**
 * Best-effort user country guess based on browser language and timezone.
 * Intentionally narrow — when we can't infer the country we leave it null
 * and ask the user to pick. We rely on the OS-reported IANA timezone and
 * the navigator.languages list, both of which are available without any
 * network call.
 */
export function guessUserCountry(): string | null {
  if (typeof window === 'undefined') return null;

  // Language-based heuristic: simplified Chinese → mainland China.
  const langs = (window.navigator.languages ?? [window.navigator.language ?? '']).map(item => item.toLowerCase());
  if (langs.some(item => item === 'zh' || item.startsWith('zh-'))) {
    return 'cn';
  }

  // Timezone-based heuristic for the rest of the world.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase() ?? '';
    const tzMap: Array<[RegExp, string]> = [
      [/^asia\/(shanghai|beijing|chongqing|harbin|ur[uü]mq|hongkong|kashgar)\b/, 'cn'],
      [/^asia\/taipei\b/, 'tw'],
      [/^asia\/tokyo\b/, 'jp'],
      [/^asia\/seoul\b/, 'kr'],
      [/^asia\/hong[_ ]?kong\b/, 'hk'],
      [/^asia\/singapore\b/, 'sg'],
      [/^asia\/bangkok\b/, 'th'],
      [/^asia\/jakarta\b/, 'id'],
      [/^asia\/kuala[_ ]?lumpur\b/, 'my'],
      [/^asia\/manila\b/, 'ph'],
      [/^asia\/ho[_ ]?chi[_ ]?minh\b|^asia\/saigon\b/, 'vn'],
      [/^asia\/kolkata|^asia\/calcutta\b/, 'in'],
      [/^asia\/dubai\b/, 'ae'],
      [/^asia\/riyadh\b/, 'sa'],
      [/^asia\/tehran\b/, 'ir'],
      [/^asia\/istanbul\b/, 'tr'],
      [/^asia\/karachi\b/, 'pk'],
      [/^asia\/dhaka\b/, 'bd'],
      [/^asia\/yangon\b/, 'mm'],
      [/^europe\/london\b/, 'gb'],
      [/^europe\/paris\b/, 'fr'],
      [/^europe\/berlin\b|^europe\/vienna\b|^europe\/zurich\b|^europe\/amsterdam\b|^europe\/brussels\b|^europe\/luxembourg\b|^europe\/rome\b/, 'de'],
      [/^europe\/madrid\b/, 'es'],
      [/^europe\/lisbon\b/, 'pt'],
      [/^europe\/rome\b/, 'it'],
      [/^europe\/warsaw\b|^europe\/prague\b|^europe\/budapest\b|^europe\/vienna\b|^europe\/berlin\b/, 'pl'],
      [/^europe\/moscow\b/, 'ru'],
      [/^europe\/athens\b/, 'gr'],
      [/^europe\/oslo\b|^europe\/stockholm\b|^europe\/copenhagen\b|^europe\/helsinki\b/, 'no'],
      [/^europe\/dublin\b/, 'ie'],
      [/^america\/new_york\b|^america\/chicago\b|^america\/denver\b|^america\/los_angeles\b|^america\/phoenix\b|^us\/.*/, 'us'],
      [/^america\/toronto\b|^america\/vancouver\b|^america\/montreal\b/, 'ca'],
      [/^america\/mexico_city\b|^america\/mexico\b/, 'mx'],
      [/^america\/sao_paulo\b|^america\/rio_branco\b|^america\/manaus\b/, 'br'],
      [/^america\/buenos_aires\b|^america\/argentina\b/, 'ar'],
      [/^america\/santiago\b/, 'cl'],
      [/^america\/bogota\b/, 'co'],
      [/^america\/lima\b/, 'pe'],
      [/^africa\/cairo\b/, 'eg'],
      [/^africa\/lagos\b|^africa\/abuja\b/, 'ng'],
      [/^africa\/johannesburg\b/, 'za'],
      [/^africa\/nairobi\b/, 'ke'],
      [/^africa\/casablanca\b/, 'ma'],
      [/^africa\/tunis\b/, 'tn'],
      [/^africa\/algiers\b/, 'dz'],
      [/^australia\/sydney\b|^australia\/melbourne\b|^australia\/brisbane\b|^australia\/perth\b|^australia\/adelaide\b/, 'au'],
      [/^pacific\/auckland\b/, 'nz'],
    ];
    for (const [pattern, code] of tzMap) {
      if (pattern.test(tz)) return code;
    }
  } catch {
    // Intl unavailable — skip timezone heuristic.
  }

  return null;
}
