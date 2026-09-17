/**
 * The credited-role vocabulary offered by the crew editor.
 *
 * Directors, producers and cast get fixed sets: these are festival credit
 * categories, not a free-form list, and staff should not be able to invent a
 * fifth acting category. Other Crew is open-ended by nature, so its options
 * come from the admin-managed `/credit-roles` list instead — see
 * backend/models/creditRole.model.ts.
 */

export type CrewGroupKey = 'directors' | 'producers' | 'actors' | 'other';

export const FIXED_ROLE_OPTIONS: Record<
  Exclude<CrewGroupKey, 'other'>,
  readonly string[]
> = {
  directors: ['Director', 'Co-Director'],
  producers: ['Producer', 'Executive Producer'],
  actors: [
    'Actor in a leading role',
    'Actress in a leading role',
    'Actor in a supporting role',
    'Actress in a supporting role',
  ],
};

/**
 * Merges a stored role into the options it will be shown alongside.
 *
 * Existing crew was entered as free text on the public submit-film form, so a
 * stored role is very often something no list contains — "Director/Writer",
 * "DOP", a typo. A plain <select> shows no match for those, and the next save
 * would write back whatever the browser picked instead, quietly rewriting a
 * filmmaker's credit.
 *
 * Keeping the stored value as an option means the field round-trips
 * unchanged unless someone deliberately changes it. Comparison is
 * case-insensitive so "editor" doesn't get listed twice next to "Editor";
 * the stored casing wins, since that is what will be saved if untouched.
 */
export function withStoredRole(
  options: readonly string[],
  stored: string | undefined,
): { options: string[]; isOffList: boolean } {
  const value = (stored ?? '').trim();
  if (!value) return { options: [...options], isOffList: false };

  const match = options.find(
    (option) => option.toLowerCase() === value.toLowerCase(),
  );
  if (match) return { options: [...options], isOffList: false };

  return { options: [value, ...options], isOffList: true };
}
