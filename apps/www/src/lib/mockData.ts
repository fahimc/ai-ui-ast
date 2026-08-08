/**
 * Mock application data resolved by `$binding`s in the live preview. Every
 * binding used by the samples and gallery scenarios must resolve here so the
 * playground renders real values, never "[object Object]" or a raw `$path`.
 */
export const MOCK_DATA: Record<string, unknown> = {
  customer: {
    name: 'Ada Lovelace',
    email: 'ada@analytical.engine',
    plan: 'Pro',
    status: 'Active',
    projects: 12,
    storage: '48 GB',
    avatar: 'https://i.pravatar.cc/96?img=47',
  },
  user: {
    name: 'Grace Hopper',
    loggedIn: true,
    role: 'Admin',
    projects: 12,
  },
  items: [
    { id: 1, name: 'Design system audit', status: 'Done', assignee: 'Ada' },
    { id: 2, name: 'AUI compiler v0', status: 'In progress', assignee: 'Grace' },
    { id: 3, name: 'Registry adapter: Radix', status: 'Planned', assignee: 'Alan' },
  ],
  projects: [
    { id: 1, name: 'Website redesign', progress: '75%', color: 'var(--accent)' },
    { id: 2, name: 'Mobile app', progress: '40%', color: '#34d399' },
    { id: 3, name: 'Design tokens', progress: '90%', color: '#fbbf24' },
  ],
  notifications: 3,
  showAdvanced: true,
  metrics: {
    revenue: '$128.4k',
    users: '48,201',
    active: '9,312',
    churn: '1.8%',
    trend: [12, 18, 15, 26, 24, 31, 34],
    series: [
      { month: 'Jan', revenue: 42, users: 21 },
      { month: 'Feb', revenue: 55, users: 28 },
      { month: 'Mar', revenue: 48, users: 30 },
      { month: 'Apr', revenue: 71, users: 38 },
      { month: 'May', revenue: 84, users: 45 },
      { month: 'Jun', revenue: 98, users: 51 },
    ],
  },
  form: {
    email: 'ada@example.com',
    password: '',
    remember: true,
    card: '4242 4242 4242 4242',
    expiry: '08 / 29',
    cvc: '123',
  },
  prefs: { email: true, push: false },
  query: { loading: false },
  plan: { tier: 'Pro', renewsAt: 'Aug 1, 2026' },
};
