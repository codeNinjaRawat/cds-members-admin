/** Names of our own icon set (components/icons/MemberIcon.tsx) – admins pick icons by these names. */
export const MEMBER_ICONS = ['email', 'person', 'plan', 'family', 'pledge', 'review', 'pay', 'vote', 'discount', 'masjid', 'pin', 'calendar', 'shield', 'phone', 'star', 'form', 'home', 'check'] as const;
export type MemberIconName = (typeof MEMBER_ICONS)[number];
