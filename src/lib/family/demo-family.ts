/**
 * DEMO family trees for the two demo member accounts (no API). Names are invented.
 * Aisha's tree shows every case: members who can vote, a parent with a lapsed membership, adults who can join,
 * a daughter who turns 18 before the 2027 record date, young children, and older generations as family history.
 */
import type { Family } from './family';

const AISHA: Family = {
  rootId: 'aisha',
  people: [
    // heritage (older generations – names only, private to the family)
    { id: 'ghulam', first: 'Ghulam', last: 'Rasul', sex: 'm', born: '1898', died: '1961', place: 'Lahore', heritage: true },
    { id: 'hamida', first: 'Hamida', last: 'Bibi', sex: 'f', born: '1904', died: '1979', place: 'Lahore', heritage: true },
    { id: 'latif', first: 'Abdul Latif', last: 'Khan', sex: 'm', born: '1924', died: '1998', place: 'Karachi', heritage: true },
    { id: 'zubaida', first: 'Zubaida', last: 'Khan', sex: 'f', born: '1929', died: '2010', place: 'Karachi', heritage: true },
    { id: 'mahmood', first: 'Mahmood', last: 'Ali', sex: 'm', born: '1926', died: '2003', place: 'Hyderabad', heritage: true },
    { id: 'rabia', first: 'Rabia', last: 'Ali', sex: 'f', born: '1931', died: '2017', place: 'Houston', heritage: true },
    // parents
    { id: 'tariq', first: 'Tariq', last: 'Khan', sex: 'm', born: '1954-08-02', member: { memberId: 'HOU-100231', status: 'life', canVote: true, accepted: true } },
    { id: 'nasreen', first: 'Nasreen', last: 'Khan', sex: 'f', born: '1958-01-19', member: { memberId: 'HOU-100232', status: 'expired', canVote: false, accepted: true } },
    { id: 'yusufR', first: 'Yusuf', last: 'Rahman', sex: 'm', born: '1951-05-11' },
    { id: 'fatimaR', first: 'Fatima', last: 'Rahman', sex: 'f', born: '1955-12-03', invited: '2026-09-20' },
    // generation 0
    { id: 'aisha', first: 'Aisha', last: 'Rahman', sex: 'f', born: '1986-04-21', member: { memberId: 'HOU-204781', status: 'active', canVote: true, accepted: true } },
    { id: 'omar', first: 'Omar', last: 'Rahman', sex: 'm', born: '1983-10-07', member: { memberId: 'HOU-204782', status: 'active', canVote: true, accepted: true } },
    { id: 'bilal', first: 'Bilal', last: 'Khan', sex: 'm', born: '1989-02-15', member: { memberId: 'HOU-209114', status: 'active', canVote: true, accepted: true } },
    { id: 'sara', first: 'Sara', last: 'Khan', sex: 'f', born: '1991-07-30' },
    { id: 'hana', first: 'Hana', last: 'Khan', sex: 'f', born: '1994-11-09', member: { memberId: 'HOU-212040', status: 'pending', canVote: false, accepted: true } },
    // children
    { id: 'sumayya', first: 'Sumayya', last: 'Rahman', sex: 'f', born: '2009-03-14' },
    { id: 'ibrahim', first: 'Ibrahim', last: 'Rahman', sex: 'm', born: '2012-06-05' },
    { id: 'maryam', first: 'Maryam', last: 'Rahman', sex: 'f', born: '2016-09-22' },
    { id: 'zayd', first: 'Zayd', last: 'Khan', sex: 'm', born: '2015-01-28' },
  ],
  unions: [
    { id: 'u-gr', a: 'ghulam', b: 'hamida', children: ['latif'] },
    { id: 'u-lz', a: 'latif', b: 'zubaida', children: ['tariq'] },
    { id: 'u-mr', a: 'mahmood', b: 'rabia', children: ['nasreen'] },
    { id: 'u-tn', a: 'tariq', b: 'nasreen', children: ['bilal', 'aisha', 'hana'] },
    { id: 'u-yf', a: 'yusufR', b: 'fatimaR', children: ['omar'] },
    { id: 'u-oa', a: 'omar', b: 'aisha', children: ['sumayya', 'ibrahim', 'maryam'] },
    { id: 'u-bs', a: 'bilal', b: 'sara', children: ['zayd'] },
  ],
};

const IMRAN: Family = {
  rootId: 'imran',
  people: [
    { id: 'hafeez', first: 'Abdul Hafeez', last: 'Siddiqui', sex: 'm', born: '1930', died: '2001', place: 'Aligarh', heritage: true },
    { id: 'amina', first: 'Amina', last: 'Siddiqui', sex: 'f', born: '1936', died: '2014', place: 'Houston', heritage: true },
    { id: 'imran', first: 'Imran', last: 'Siddiqui', sex: 'm', born: '1961-03-02', member: { memberId: 'HOU-100562', status: 'life', canVote: true, accepted: true } },
    { id: 'nadia', first: 'Nadia', last: 'Siddiqui', sex: 'f', born: '1964-09-17', member: { memberId: 'HOU-100563', status: 'life', canVote: true, accepted: true } },
    { id: 'adnan', first: 'Adnan', last: 'Siddiqui', sex: 'm', born: '1990-05-26', member: { memberId: 'HOU-205610', status: 'active', canVote: true, accepted: true } },
    { id: 'layla', first: 'Layla', last: 'Siddiqui', sex: 'f', born: '1992-12-01' },
    { id: 'safa', first: 'Safa', last: 'Siddiqui', sex: 'f', born: '1995-08-14', member: { memberId: 'HOU-207733', status: 'expired', canVote: false, accepted: true } },
    { id: 'hamza', first: 'Hamza', last: 'Siddiqui', sex: 'm', born: '2019-04-03' },
  ],
  unions: [
    { id: 'u-ha', a: 'hafeez', b: 'amina', children: ['imran'] },
    { id: 'u-in', a: 'imran', b: 'nadia', children: ['adnan', 'safa'] },
    { id: 'u-al', a: 'adnan', b: 'layla', children: ['hamza'] },
  ],
};

export const DEMO_FAMILIES: Record<string, Family> = { 'aisha@example.com': AISHA, 'member@example.com': IMRAN };
