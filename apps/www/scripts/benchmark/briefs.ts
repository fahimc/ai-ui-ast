/**
 * Versioned UI brief corpus for the LLM-vs-React generation benchmark.
 *
 * Each brief is a natural-language instruction to generate a screen, plus a
 * machine-readable functional contract used to score the result. The corpus
 * spans the categories the product claims to serve: static marketing cards,
 * dashboards, forms, settings, lists/tables, conditional states,
 * empty/loading/error states, nested loops, reusable patterns, registered
 * chart components, responsive layouts, and accessibility-sensitive controls.
 *
 * Bump `version` when a brief's wording or contract changes.
 */
export interface UiBrief {
  id: string;
  version: number;
  category: string;
  title: string;
  brief: string;
  /** Functional contract used to score model output (statically where possible). */
  contract: {
    /** Component names the screen must render. */
    nodes: string[];
    /** Binding paths the screen must reference (without `$`). */
    bindings: string[];
    /** Named actions that must be wired. */
    actions: string[];
    /** Semantic change= events that must be wired. */
    events: string[];
    /** Literal text that must appear. */
    text: string[];
  };
}

const B = (
  id: string,
  category: string,
  title: string,
  brief: string,
  contract: UiBrief['contract'],
): UiBrief => ({ id, version: 1, category, title, brief, contract });

export const BRIEFS: UiBrief[] = [
  // ── Static marketing / UI cards ──────────────────────────────────────────
  B('marketing-hero', 'static', 'Marketing hero', 'Build a landing hero: a centered Stack with a Heading, supporting Text, and a primary Button labeled "Get started".', {
    nodes: ['Stack', 'Heading', 'Text', 'Button'],
    bindings: [],
    actions: ['getStarted'],
    events: [],
    text: ['Get started'],
  }),
  B('marketing-pricing', 'static', 'Pricing cards', 'Show three pricing cards in a responsive grid: Starter, Pro (featured with a Badge), and Enterprise. Each card lists features as Text lines and has a Button.', {
    nodes: ['Grid', 'Card', 'Badge', 'Button', 'Text', 'Divider', 'Heading'],
    bindings: [],
    actions: ['startStarter', 'startPro', 'contactSales'],
    events: [],
    text: ['Starter', 'Pro', 'Enterprise'],
  }),
  B('marketing-feature', 'static', 'Feature callout', 'A feature callout card with an Icon, a Heading, body Text, and a muted tone for the supporting copy.', {
    nodes: ['Card', 'Icon', 'Heading', 'Text'],
    bindings: [],
    actions: [],
    events: [],
    text: [],
  }),

  // ── Dashboards ───────────────────────────────────────────────────────────
  B('dash-overview', 'dashboard', 'Overview dashboard', 'A dashboard header with a title and a refresh Button, three Metric cards in a Grid (revenue, users, churn), and a Card containing a registered AreaChart of the revenue series.', {
    nodes: ['Page', 'Heading', 'Button', 'Grid', 'Card', 'Metric', 'AreaChart', 'Area'],
    bindings: ['metrics.revenue', 'metrics.users', 'metrics.churn', 'metrics.series'],
    actions: ['refresh'],
    events: [],
    text: ['Revenue', 'Users', 'Churn'],
  }),
  B('dash-kpis', 'dashboard', 'KPI band', 'A Row of three Metric cards bound to active, signups, and churn, with a caption Text beneath each label.', {
    nodes: ['Row', 'Card', 'Metric', 'Text'],
    bindings: ['metrics.active', 'metrics.signups', 'metrics.churn'],
    actions: [],
    events: [],
    text: [],
  }),
  B('dash-status', 'dashboard', 'Status dashboard', 'A dashboard with a live Badge, a Spinner while loading, and a For loop of recent signups showing name and status.', {
    nodes: ['Page', 'Badge', 'Spinner', 'For', 'Row', 'Avatar', 'Text'],
    bindings: ['items'],
    actions: [],
    events: [],
    text: ['Live'],
  }),

  // ── Forms ────────────────────────────────────────────────────────────────
  B('form-signin', 'form', 'Sign-in form', 'A centered Card with email and password Inputs, a "Keep me signed in" Checkbox, and a primary submit Button. Email and password changes must fire events.', {
    nodes: ['Card', 'Stack', 'Input', 'Checkbox', 'Button', 'Heading', 'Text'],
    bindings: ['form.email', 'form.password', 'form.remember'],
    actions: ['signIn'],
    events: ['emailChanged', 'passwordChanged', 'rememberChanged'],
    text: ['Keep me signed in', 'Sign in'],
  }),
  B('form-checkout', 'form', 'Checkout form', 'A checkout Card: email, card number, expiry and CVC Inputs in a Row, a "Save card" Checkbox, a warning Alert, and a "Pay $129.00" Button. Every input change fires a named event.', {
    nodes: ['Card', 'Stack', 'Input', 'Row', 'Checkbox', 'Alert', 'Button', 'Divider', 'Heading'],
    bindings: ['form.email', 'form.card', 'form.expiry', 'form.cvc', 'form.remember'],
    actions: ['pay'],
    events: ['emailChanged', 'cardChanged', 'expiryChanged', 'cvcChanged', 'rememberChanged'],
    text: ['Pay $129.00'],
  }),
  B('form-signup', 'form', 'Sign-up form', 'A sign-up Card with name, email, and a plan Select (Free, Pro, Team), plus a submit Button and a success Alert.', {
    nodes: ['Card', 'Stack', 'Input', 'Select', 'Button', 'Alert', 'Heading'],
    bindings: ['form.name', 'form.email', 'form.plan'],
    actions: ['submit'],
    events: ['nameChanged', 'emailChanged', 'planChanged'],
    text: [],
  }),

  // ── Settings screens ─────────────────────────────────────────────────────
  B('settings-notif', 'settings', 'Notification settings', 'A settings page with two Switch toggles (email, push), an info Alert, and a save Button.', {
    nodes: ['Page', 'Card', 'Stack', 'Switch', 'Alert', 'Button', 'Heading'],
    bindings: ['prefs.email', 'prefs.push'],
    actions: ['save'],
    events: ['emailToggled', 'pushToggled'],
    text: ['Email notifications', 'Push notifications'],
  }),
  B('settings-plan', 'settings', 'Plan settings', 'A plan Card with a Select bound to the plan tier, a muted renewal Text, and a danger zone Card with a delete Button.', {
    nodes: ['Page', 'Card', 'Stack', 'Select', 'Text', 'Button', 'Heading', 'Divider'],
    bindings: ['customer.plan'],
    actions: ['changePlan', 'delete'],
    events: ['planChanged'],
    text: ['Danger zone'],
  }),
  B('settings-profile', 'settings', 'Profile settings', 'A profile Card with an Avatar, a name Field, an email Field, and a primary save Button plus a secondary cancel Button.', {
    nodes: ['Page', 'Card', 'Stack', 'Avatar', 'Field', 'Button', 'Row', 'Heading'],
    bindings: ['customer.name', 'customer.email'],
    actions: ['save', 'cancel'],
    events: [],
    text: [],
  }),

  // ── Lists / tables ───────────────────────────────────────────────────────
  B('list-projects', 'list', 'Project list', 'A Section with a Heading and a For loop rendering each project as a Card with its name, progress, and a status Badge.', {
    nodes: ['Page', 'Section', 'Heading', 'For', 'Card', 'Text', 'Badge'],
    bindings: ['projects'],
    actions: [],
    events: [],
    text: [],
  }),
  B('list-teams', 'list', 'Team roster', 'A Card listing team members in a For loop: Avatar, name, and role Badge, with a divider between rows.', {
    nodes: ['Card', 'For', 'Row', 'Avatar', 'Text', 'Badge', 'Divider'],
    bindings: ['members'],
    actions: [],
    events: [],
    text: [],
  }),
  B('table-invoices', 'list', 'Invoice list', 'A list of invoices: each row shows the invoice label, amount, and a status Badge, inside a For loop with an empty-state Alert when there are none.', {
    nodes: ['For', 'Row', 'Text', 'Badge', 'Alert'],
    bindings: ['invoices'],
    actions: [],
    events: [],
    text: [],
  }),

  // ── Conditional states ───────────────────────────────────────────────────
  B('cond-admin', 'conditional', 'Role-based admin panel', 'If the user is an admin, show admin controls with a Switch and danger Button; otherwise show a usage Card with a chart.', {
    nodes: ['If', 'Else', 'Card', 'Switch', 'Button', 'AreaChart', 'Heading', 'Stack'],
    bindings: ['user.role', 'prefs.alerts', 'metrics.series'],
    actions: ['cancel'],
    events: ['alertsToggled'],
    text: ['Admin controls'],
  }),
  B('cond-auth', 'conditional', 'Signed-in vs signed-out', 'If the user is logged in show their avatar, name, and a sign-out Button; Else show a sign-in Button.', {
    nodes: ['If', 'Else', 'Avatar', 'Badge', 'Button', 'Heading', 'Text'],
    bindings: ['user.loggedIn', 'user.name'],
    actions: ['signOut', 'signIn'],
    events: [],
    text: [],
  }),
  B('cond-promo', 'conditional', 'Conditional promo', 'If the user has a discount, show a success Alert with the savings; otherwise show a muted upgrade Text and a primary Button.', {
    nodes: ['If', 'Else', 'Alert', 'Text', 'Button'],
    bindings: ['user.discount'],
    actions: ['upgrade'],
    events: [],
    text: [],
  }),

  // ── Empty / loading / error states ───────────────────────────────────────
  B('state-empty', 'states', 'Empty state', 'A friendly empty state: centered Stack with an Icon, a Heading, muted Text, and a primary Button to create the first item.', {
    nodes: ['Stack', 'Icon', 'Heading', 'Text', 'Button'],
    bindings: [],
    actions: ['createFirst'],
    events: [],
    text: ['No items yet'],
  }),
  B('state-loading', 'states', 'Loading state', 'While loading, show a centered Spinner with a muted "Loading…" Text; the main content should be gated on an If.', {
    nodes: ['If', 'Spinner', 'Text', 'Card'],
    bindings: ['query.loading'],
    actions: [],
    events: [],
    text: ['Loading'],
  }),
  B('state-error', 'states', 'Error state', 'If an error occurred, show an error Alert with a retry Button; otherwise show the content Card.', {
    nodes: ['If', 'Else', 'Alert', 'Button', 'Card'],
    bindings: ['query.error'],
    actions: ['retry'],
    events: [],
    text: ['Something went wrong'],
  }),

  // ── Nested loops ─────────────────────────────────────────────────────────
  B('nested-sections', 'nested-loops', 'Sections of items', 'A For loop over sections, each containing its own For loop of items with name and status.', {
    nodes: ['For', 'Section', 'Heading', 'Card', 'Row', 'Text', 'Badge'],
    bindings: ['sections'],
    actions: [],
    events: [],
    text: [],
  }),
  B('nested-groups', 'nested-loops', 'Grouped metrics', 'Group metrics by category: an outer For over groups, an inner For over metrics with label and value, each group in a Card.', {
    nodes: ['For', 'Card', 'Stack', 'Metric', 'Heading'],
    bindings: ['groups'],
    actions: [],
    events: [],
    text: [],
  }),
  B('nested-board', 'nested-loops', 'Kanban board', 'A board with columns from a For loop; each column lists its cards in an inner For loop, each card showing a title Text and a priority Badge.', {
    nodes: ['For', 'Row', 'Card', 'Stack', 'Text', 'Badge', 'Heading'],
    bindings: ['board.columns'],
    actions: [],
    events: [],
    text: [],
  }),

  // ── Reusable patterns ────────────────────────────────────────────────────
  B('reuse-statcard', 'reusable', 'Stat card component', 'Define a StatCard component (label, value, tone with a default) and use it four times for different metrics.', {
    nodes: ['StatCard', 'Card', 'Grid', 'Metric', 'Text', 'Heading'],
    bindings: ['metrics.revenue', 'metrics.active', 'metrics.churn', 'customer.projects'],
    actions: [],
    events: [],
    text: [],
  }),
  B('reuse-listrow', 'reusable', 'List row component', 'Define a ListRow component taking name, status, and tone, then render a list of them from a For loop.', {
    nodes: ['ListRow', 'For', 'Row', 'Text', 'Badge'],
    bindings: ['items'],
    actions: [],
    events: [],
    text: [],
  }),
  B('reuse-emptycard', 'reusable', 'Empty card component', 'Define an EmptyCard component taking icon and message with a default tone, and use it in an Else branch.', {
    nodes: ['EmptyCard', 'If', 'Else', 'Icon', 'Heading', 'Text'],
    bindings: ['items.length'],
    actions: [],
    events: [],
    text: ['No results'],
  }),

  // ── Registered chart components ──────────────────────────────────────────
  B('chart-revenue', 'charts', 'Revenue chart', 'A Card with a heading and a registered AreaChart of the revenue series, with an Area layer keyed to revenue.', {
    nodes: ['Card', 'Heading', 'AreaChart', 'Area'],
    bindings: ['metrics.series'],
    actions: [],
    events: [],
    text: ['Revenue trend'],
  }),
  B('chart-grid', 'charts', 'Chart grid', 'A Grid of two chart Cards: a registered AreaChart of users and a registered AreaChart of revenue, each with a heading.', {
    nodes: ['Grid', 'Card', 'Heading', 'AreaChart', 'Area'],
    bindings: ['metrics.series'],
    actions: [],
    events: [],
    text: [],
  }),
  B('chart-axis', 'charts', 'Chart with axes', 'An AreaChart with a CartesianGrid and an XAxis keyed to month, plus the Area series, inside a padded Card.', {
    nodes: ['Card', 'AreaChart', 'Area', 'CartesianGrid', 'XAxis'],
    bindings: ['metrics.series'],
    actions: [],
    events: [],
    text: [],
  }),

  // ── Responsive layouts ───────────────────────────────────────────────────
  B('resp-dashboard', 'responsive', 'Responsive dashboard', 'A responsive dashboard: a Grid with min=240 for metric cards, a full-width chart Card, and a responsive Row of actions.', {
    nodes: ['Page', 'Grid', 'Card', 'Metric', 'AreaChart', 'Row', 'Button', 'Heading'],
    bindings: ['metrics.revenue', 'metrics.active', 'metrics.series'],
    actions: ['refresh'],
    events: [],
    text: [],
  }),
  B('resp-hero', 'responsive', 'Responsive hero', 'A hero with a two-column feel: a left Stack of heading, text, and buttons, and a right Card, wrapped so it stacks on narrow screens.', {
    nodes: ['Row', 'Stack', 'Heading', 'Text', 'Button', 'Card'],
    bindings: [],
    actions: ['learnMore', 'signUp'],
    events: [],
    text: [],
  }),
  B('resp-pricing', 'responsive', 'Responsive pricing', 'A responsive pricing grid (min=260) of three plan Cards with feature lists and action Buttons.', {
    nodes: ['Grid', 'Card', 'Stack', 'Heading', 'Text', 'Button', 'Badge', 'Divider'],
    bindings: [],
    actions: ['chooseFree', 'choosePro', 'chooseTeam'],
    events: [],
    text: [],
  }),

  // ── Accessibility-sensitive controls ─────────────────────────────────────
  B('a11y-form', 'a11y', 'Labeled form', 'A form where every Input has an accessible label, a Checkbox with a clear label, and a clearly labeled submit Button.', {
    nodes: ['Card', 'Stack', 'Field', 'Input', 'Checkbox', 'Button', 'Heading'],
    bindings: ['form.email', 'form.password', 'form.remember'],
    actions: ['submit'],
    events: ['emailChanged', 'passwordChanged'],
    text: ['Email', 'Password'],
  }),
  B('a11y-status', 'a11y', 'Status communication', 'A status page that communicates state: a success Alert, a loading Spinner with a status label, and an error Alert with a retry Button.', {
    nodes: ['Alert', 'Spinner', 'Button', 'Stack'],
    bindings: ['query.loading'],
    actions: ['retry'],
    events: [],
    text: ['All systems operational', 'Loading'],
  }),
  B('a11y-toggles', 'a11y', 'Toggle settings', 'Settings toggles with clear labels: two Switches for email and push, each with a change event, and a save Button.', {
    nodes: ['Card', 'Stack', 'Switch', 'Button', 'Heading'],
    bindings: ['prefs.email', 'prefs.push'],
    actions: ['save'],
    events: ['emailToggled', 'pushToggled'],
    text: ['Email', 'Push'],
  }),
];
