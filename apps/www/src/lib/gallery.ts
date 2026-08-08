/**
 * Gallery scenarios used by the Examples page and the token benchmark.
 *
 * Every scenario declares a machine-readable `features` contract (rendered
 * nodes, bindings, actions, events). The token benchmark fails when a
 * declared feature is missing from either implementation, so `.aui` and
 * hand-written React are only ever compared when they are functionally
 * equivalent.
 *
 * Third-party components (AreaChart, Area, …) are *registered* in the
 * website registry (`lib/registry.ts`), not imported inline — the model
 * never writes import lines.
 */
export interface ScenarioFeatures {
  /** Registry/def component names the scenario renders. */
  render: string[];
  /** Binding paths used (without the `$`). */
  bindings: string[];
  /** Named actions routed through `onAction`. */
  actions: string[];
  /** Semantic change= event action names. */
  events: string[];
}

export interface GalleryScenario {
  id: string;
  title: string;
  /** Category tag shown on the card. */
  feature: string;
  tagline: string;
  /** What the scenario demonstrates. */
  highlights: string[];
  auiCode: string;
  features: ScenarioFeatures;
}

export const GALLERY: GalleryScenario[] = [
  {
    id: 'imports',
    title: 'Third-party libraries',
    feature: 'Imports',
    tagline: 'Registered chart components reach real libraries without an import line.',
    highlights: [
      '`AreaChart` is registered in the host registry and maps to `@acme/charts` — the model just writes `AreaChart data=$metrics.series`.',
      'The compiler derives the import from the registry, deterministically and deduplicated.',
      'Strict compilation cannot invent arbitrary package specifiers.',
    ],
    features: {
      render: ['AreaChart', 'Area', 'XAxis', 'CartesianGrid', 'Badge', 'Button', 'Card', 'Heading', 'Row', 'Stack', 'Text'],
      bindings: ['metrics.series'],
      actions: ['export'],
      events: [],
    },
    auiCode: `Page Revenue data=$metrics
  Stack gap=lg
    Row gap=md align=center justify=between
      Stack gap=xs
        Heading level=1 "Revenue overview"
        Text tone=muted "Monthly recurring revenue, last 6 months"
      Row gap=sm align=center
        Badge tone=success "Live"
        Button variant=secondary action=export "Export"

    Card pad=lg
      Heading level=2 "MRR"
      AreaChart data=$metrics.series height=280
        CartesianGrid strokeDasharray="3 3"
        XAxis dataKey="month"
        Area dataKey="revenue" stroke="#a78bfa" fill="#a78bfa"`,
  },
  {
    id: 'components',
    title: 'Reusable components',
    feature: 'Components',
    tagline: 'Define a component once with `def`, then use it everywhere.',
    highlights: [
      '`def StatCard label value tone=default` declares a template with params and defaults.',
      'Inside the body, `$label` / `$value` / `$tone` reference the params — no JS needed.',
      'One definition, four usages: the generated React gets a real local component.',
    ],
    features: {
      render: ['StatCard', 'Card', 'Grid', 'Heading', 'Stack', 'Text'],
      bindings: ['metrics.revenue', 'metrics.active', 'metrics.churn', 'customer.projects'],
      actions: [],
      events: [],
    },
    auiCode: `def StatCard label value tone=default
  Card pad=lg
    Stack gap=xs
      Text tone=muted $label
      Heading level=2 tone=$tone $value

Page Metrics data=$metrics
  Grid min=220 gap=md
    StatCard label="Revenue" value=$metrics.revenue tone=success
    StatCard label="Active users" value=$metrics.active tone=info
    StatCard label="Churn rate" value=$metrics.churn tone=warning
    StatCard label="Projects" value=$customer.projects`,
  },
  {
    id: 'logic',
    title: 'UI logic without JavaScript',
    feature: 'Logic',
    tagline: 'Conditional rendering with `If` / `Else` — the tree stays declarative.',
    highlights: [
      '`If condition=$user.loggedIn` renders one subtree, `Else` the other.',
      'No ternary soup, no && chains — the branch is just indentation.',
      'The compiler emits the ternary for you, exactly once, deterministically.',
    ],
    features: {
      render: ['Avatar', 'Badge', 'Button', 'Card', 'Divider', 'Heading', 'Row', 'Stack', 'Text'],
      bindings: ['user.loggedIn', 'user.name'],
      actions: ['signOut', 'signIn'],
      events: [],
    },
    auiCode: `Page Account data=$user
  If condition=$user.loggedIn
    Card pad=lg
      Stack gap=md
        Row gap=md align=center
          Avatar label=$user.name
          Stack gap=xs
            Heading level=2 $user.name
            Badge tone=success "Online"
        Divider
        Button variant=primary action=signOut "Sign out"
  Else
    Card pad=lg
      Stack gap=md
        Heading level=2 "Sign in to continue"
        Text tone=muted "Your workspace is waiting."
        Button variant=primary action=signIn "Sign in"`,
  },
  {
    id: 'business',
    title: 'Business logic wiring',
    feature: 'Logic',
    tagline: 'Forms, validation states, and actions — wired, not coded.',
    highlights: [
      'Inputs bind to app state: `value=$form.email` — the model owns the state.',
      'Semantic events: `change=emailChanged` compiles to a target `onChange` with the value payload.',
      'Actions are named references: `action=pay` routes through `onAction`, never inline code.',
    ],
    features: {
      render: ['Alert', 'Button', 'Card', 'Checkbox', 'Divider', 'Heading', 'Input', 'Row', 'Stack', 'Text'],
      bindings: ['form.email', 'form.card', 'form.expiry', 'form.cvc', 'form.remember'],
      actions: ['pay'],
      events: ['emailChanged', 'cardChanged', 'expiryChanged', 'cvcChanged', 'rememberChanged'],
    },
    auiCode: `Page Checkout
  Card pad=lg
    Stack gap=md
      Heading level=2 "Checkout"
      Text tone=muted "One-time payment · Pro plan"
      Divider
      Stack gap=md
        Input type=email placeholder="Email" value=$form.email change=emailChanged
        Input type=text placeholder="Card number" value=$form.card change=cardChanged
        Row gap=md
          Input type=text placeholder="MM / YY" value=$form.expiry change=expiryChanged
          Input type=text placeholder="CVC" value=$form.cvc change=cvcChanged
        Checkbox checked=$form.remember change=rememberChanged "Save card for next time"
      Alert tone=warning "Test mode — no real charge will be made."
      Button variant=primary action=pay size=lg "Pay $129.00"`,
  },
  {
    id: 'live-data',
    title: 'Dashboard on live data',
    feature: 'Live data',
    tagline: 'Streaming metrics, charts, and lists — all bound, none hard-coded.',
    highlights: [
      '`Page LiveDashboard data=$metrics` scopes every binding to a live data context.',
      '`StatCard value=$metrics.revenue` and `AreaChart data=$metrics.series` read straight from it.',
      '`For each=$items` turns a list binding into rendered rows — with `$item` in scope.',
    ],
    features: {
      render: ['StatCard', 'AreaChart', 'Area', 'XAxis', 'CartesianGrid', 'Avatar', 'Badge', 'Button', 'Card', 'Grid', 'Heading', 'Row', 'Section', 'Stack', 'Text'],
      bindings: ['metrics.revenue', 'metrics.users', 'metrics.churn', 'metrics.series', 'items'],
      actions: ['refresh'],
      events: [],
    },
    auiCode: `def StatCard label value tone=default
  Card pad=lg
    Stack gap=xs
      Text tone=muted $label
      Heading level=2 tone=$tone $value

Page LiveDashboard data=$metrics
  Stack gap=lg
    Row gap=md align=center justify=between
      Stack gap=xs
        Heading level=1 "Live overview"
        Badge tone=success "Streaming"
      Button variant=secondary action=refresh "Refresh"

    Grid min=220 gap=md
      StatCard label="Revenue" value=$metrics.revenue tone=success
      StatCard label="Users" value=$metrics.users tone=info
      StatCard label="Churn" value=$metrics.churn tone=warning

    Card pad=lg
      Heading level=2 "Revenue trend"
      AreaChart data=$metrics.series height=240
        CartesianGrid strokeDasharray="3 3"
        XAxis dataKey="month"
        Area dataKey="revenue" stroke="#a78bfa" fill="#a78bfa"

    Section
      Heading level=2 "Recent signups"
      For each=$items
        Row gap=md align=center justify=between
          Row gap=sm align=center
            Avatar label=$item.name
            Text $item.name
          Badge tone=info $item.status`,
  },
  {
    id: 'composition',
    title: 'Everything at once',
    feature: 'Composition',
    tagline: 'A billing portal: defs, imports, logic, forms, and charts in one page.',
    highlights: [
      'Defs, registered charts, bindings, actions, and branches compose in a single file.',
      'The canonical IR is the single source of truth — the React compiler handles the rest.',
      'A small `.aui` file replaces a much larger hand-written React implementation.',
    ],
    features: {
      render: ['StatCard', 'AreaChart', 'Area', 'Button', 'Card', 'Grid', 'Heading', 'Row', 'Stack', 'Switch', 'Text'],
      bindings: ['plan.tier', 'plan.renewsAt', 'items.length', 'user.role', 'prefs.email', 'metrics.series'],
      actions: ['upgrade', 'invoices', 'cancel'],
      events: [],
    },
    auiCode: `def StatCard label value tone=default
  Card pad=lg
    Stack gap=xs
      Text tone=muted $label
      Heading level=2 tone=$tone $value

Page Billing data=$user
  Stack gap=lg
    Row gap=md align=center justify=between
      Stack gap=xs
        Heading level=1 "Billing"
        Text tone=muted "Manage your workspace plan and invoices"
      Button variant=primary action=upgrade "Upgrade"

    Grid min=220 gap=md
      StatCard label="Current plan" value=$plan.tier tone=info
      StatCard label="Renews" value=$plan.renewsAt
      StatCard label="Seats" value=$items.length

    If condition=$user.role
      Card pad=lg
        Stack gap=md
          Heading level=2 "Admin controls"
          Switch checked=$prefs.email "Email alerts"
          Row gap=sm
            Button variant=secondary action=invoices "View invoices"
            Button variant=danger action=cancel "Cancel subscription"
    Else
      Card pad=lg
        Stack gap=md
          Heading level=2 "Usage"
          AreaChart data=$metrics.series height=180
            Area dataKey="users" stroke="#34d399" fill="#34d399"`,
  },
];
