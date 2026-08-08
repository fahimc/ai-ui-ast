/**
 * Deterministic fixtures for the LLM benchmark's fixture mode.
 *
 * Fixture mode runs the harness end-to-end without API credentials: each
 * brief gets a canned "model output" in both conditions. These are generated
 * from the brief's contract so that every declared node, action, event,
 * binding, and text is covered — and they are valid by construction, which
 * the runner verifies (a strict compile must pass). Live mode replaces these
 * with real model responses.
 */
import type { UiBrief } from './briefs.ts';

const LIST_ROOTS = new Set(['items', 'projects', 'members', 'invoices', 'sections', 'groups', 'board.columns']);

function pascal(title: string): string {
  return title
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

/** Build a valid .aui screen from a brief's contract. */
export function auiFixture(brief: UiBrief): string {
  const { contract } = brief;
  const lines: string[] = [`Page ${pascal(brief.title)} data=$user`, `  Stack gap=md`];

  // Actions → one Button each.
  for (const action of contract.actions) {
    lines.push(`    Button variant=primary action=${action} "${pascal(action)}"`);
  }

  // Events → one Input (change=) each, so every event is wired.
  contract.events.forEach((event, i) => {
    lines.push(`    Input type=text placeholder="Field ${i + 1}" value=$form.field${i} change=${event}`);
  });

  // List bindings → a For loop with $item in scope.
  const listBinding = contract.bindings.find((p) => LIST_ROOTS.has(p));
  if (listBinding) {
    lines.push(`    For each=$${listBinding}`, `      Row gap=md align=center`, `        Avatar label=$item.name`, `        Text $item.name`, `        Badge tone=info $item.status`);
  }

  // Conditional briefs → If/Else.
  if (contract.nodes.includes('If') || contract.nodes.includes('Else')) {
    lines.push(`    If condition=$user.loggedIn`, `      Card pad=lg`, `        Stack gap=md`, `          Heading level=2 "Member"`, `          Text tone=muted "Signed in"`);
    if (contract.nodes.includes('Switch')) lines.push(`        Switch checked=$prefs.alerts "Alerts"`);
    if (contract.nodes.includes('AreaChart')) lines.push(`      AreaChart data=$metrics.series height=180`);
    lines.push(`    Else`, `      Card pad=lg`, `        Stack gap=md`, `          Heading level=2 "Guest"`, `          Text tone=muted "Signed out"`);
  }

  // Registered charts.
  if (contract.nodes.includes('AreaChart')) {
    lines.push(`    Card pad=lg`, `      Heading level=2 "Trend"`, `      AreaChart data=$metrics.series height=240`);
    if (contract.nodes.includes('CartesianGrid')) lines.push(`        CartesianGrid strokeDasharray="3 3"`);
    if (contract.nodes.includes('XAxis')) lines.push(`        XAxis dataKey="month"`);
    if (contract.nodes.includes('Area')) lines.push(`        Area dataKey="revenue" stroke="#a78bfa" fill="#a78bfa"`);
  }

  // Reusable defs.
  if (contract.nodes.includes('StatCard')) {
    lines.push(
      `def StatCard label value tone=default`,
      `  Card pad=lg`,
      `    Stack gap=xs`,
      `      Text tone=muted $label`,
      `      Heading level=2 tone=$tone $value`,
      ``,
    );
    lines.push(`    StatCard label="Revenue" value=$metrics.revenue tone=success`);
  }
  if (contract.nodes.includes('ListRow')) {
    lines.push(
      `def ListRow name status tone=default`,
      `  Row gap=md align=center`,
      `    Text $name`,
      `    Badge tone=$tone $status`,
      ``,
    );
    lines.push(`    ListRow name="Item" status="Done"`);
  }
  if (contract.nodes.includes('EmptyCard')) {
    lines.push(
      `def EmptyCard icon message tone=muted`,
      `  Card pad=lg`,
      `    Stack gap=sm align=center`,
      `      Icon name=$icon`,
      `      Heading level=3 $message`,
      ``,
    );
    lines.push(`    EmptyCard icon=home message="No results"`);
  }

  // Remaining nodes, each as a valid minimal element.
  for (const node of contract.nodes) {
    if (['Page', 'If', 'Else', 'For', 'StatCard', 'ListRow', 'EmptyCard', 'AreaChart', 'Area', 'CartesianGrid', 'XAxis'].includes(node)) continue;
    switch (node) {
      case 'Stack':
        lines.push(`    Stack gap=md`);
        break;
      case 'Row':
        lines.push(`    Row gap=md align=center`);
        break;
      case 'Grid':
        lines.push(`    Grid min=240 gap=md`);
        break;
      case 'Card':
        lines.push(`    Card pad=lg`);
        break;
      case 'Section':
        lines.push(`    Section`);
        break;
      case 'Heading':
        lines.push(`    Heading level=2 "Heading"`);
        break;
      case 'Text':
        lines.push(`    Text "Body text"`);
        break;
      case 'Icon':
        lines.push(`    Icon name=home`);
        break;
      case 'Divider':
        lines.push(`    Divider`);
        break;
      case 'Badge':
        lines.push(`    Badge tone=info "Badge"`);
        break;
      case 'Spinner':
        lines.push(`    Spinner size=md`);
        break;
      case 'Avatar':
        lines.push(`    Avatar label=$user.name`);
        break;
      case 'Metric':
        lines.push(`    Metric label="Metric" value=$user.name`);
        break;
      case 'Field':
        lines.push(`    Field label="Field" value=$user.name`);
        break;
      case 'Button':
        // (already emitted per action above; skip if none declared)
        break;
      case 'Input':
        // (already emitted per event above; skip if none declared)
        break;
      case 'Select':
        lines.push(`    Select value=$form.plan options="Free,Pro,Team"`);
        break;
      case 'Checkbox':
        lines.push(`    Checkbox checked=$form.remember "Remember me"`);
        break;
      case 'Switch':
        // (already handled in the If/Else block when present)
        if (!contract.nodes.includes('If')) lines.push(`    Switch checked=$prefs.email "Toggle"`);
        break;
      case 'Alert':
        lines.push(`    Alert tone=info "Alert"`);
        break;
      default:
        lines.push(`    ${node}`);
        break;
    }
  }

  // Binding + text coverage: every declared binding and literal must appear.
  const emitted = lines.join('\n');
  for (const b of contract.bindings) {
    if (!emitted.includes('$' + b)) lines.push(`    Text $${b}`);
  }
  for (const t of contract.text) {
    if (!emitted.includes(t)) lines.push(`    Text "${t}"`);
  }

  return lines.join('\n');
}

/** Build a minimal valid React implementation of the same screen. */
export function reactFixture(brief: UiBrief): string {
  const { contract } = brief;
  const core = new Set(['Button', 'Card', 'Checkbox', 'Divider', 'Field', 'Grid', 'Heading', 'Icon', 'Input', 'Metric', 'Row', 'Section', 'Select', 'Spinner', 'Stack', 'Switch', 'Text', 'Avatar', 'Badge', 'Alert', 'Page']);
  const parts: string[] = [];
  if (contract.nodes.includes('AreaChart')) parts.push(`import { Area, AreaChart, CartesianGrid, XAxis } from '@acme/charts';`);
  const used = contract.nodes.filter((n) => core.has(n));
  if (used.length > 0) parts.push(`import { ${[...new Set(used)].sort().join(', ')} } from '@/components/ui';`);

  // Reusable defs as local components.
  if (contract.nodes.includes('StatCard')) {
    parts.push('', `function StatCard({ label, value, tone = 'default' }: any) {`, `  return (`, `    <Card pad="lg"><Text>{label}</Text><Heading level={2} tone={tone}>{value}</Heading></Card>`, `  );`, `}`, '');
  }
  if (contract.nodes.includes('ListRow')) {
    parts.push('', `function ListRow({ name, status, tone = 'default' }: any) {`, `  return (`, `    <Row gap="md" align="center"><Text>{name}</Text><Badge tone={tone}>{status}</Badge></Row>`, `  );`, `}`, '');
  }
  if (contract.nodes.includes('EmptyCard')) {
    parts.push('', `function EmptyCard({ icon, message }: any) {`, `  return (`, `    <Card pad="lg"><Icon name={icon} /><Heading level={3}>{message}</Heading></Card>`, `  );`, `}`, '');
  }

  parts.push('');
  parts.push(`export function ${pascal(brief.title)}({ data, onAction }: { data: any; onAction: (name: string, payload?: unknown) => void }) {`);
  parts.push(`  return (`);
  if (contract.nodes.includes('Page')) parts.push(`    <Page>`);
  parts.push(`    <Stack gap="md">`);
  for (const action of contract.actions) {
    parts.push(`      <Button variant="primary" onClick={() => onAction('${action}')}>${pascal(action)}</Button>`);
  }
  contract.events.forEach((event, i) => {
    parts.push(`      <Input placeholder="Field ${i + 1}" value={data.form.field${i}} onChange={(e) => onAction('${event}', e.target.value)} />`);
  });
  const listBinding = contract.bindings.find((p) => LIST_ROOTS.has(p));
  if (listBinding) {
    parts.push(`      {data.${listBinding}.map((item) => (`);
    parts.push(`        <Row key={item.id} gap="md" align="center">`);
    parts.push(`          <Avatar label={item.name} />`);
    parts.push(`          <Text>{item.name}</Text>`);
    parts.push(`          <Badge tone="info">{item.status}</Badge>`);
    parts.push(`        </Row>`);
    parts.push(`      ))}`);
  }
  if (contract.nodes.includes('AreaChart')) {
    parts.push(`      <AreaChart data={data.metrics.series} height={240}>`);
    if (contract.nodes.includes('CartesianGrid')) parts.push(`        <CartesianGrid strokeDasharray="3 3" />`);
    if (contract.nodes.includes('XAxis')) parts.push(`        <XAxis dataKey="month" />`);
    if (contract.nodes.includes('Area')) parts.push(`        <Area dataKey="revenue" stroke="#a78bfa" fill="#a78bfa" />`);
    parts.push(`      </AreaChart>`);
  }
  // Remaining nodes as balanced, self-contained elements (containers are
  // self-closing so the fixture is always valid TSX; node presence is what
  // the contract checks).
  for (const node of contract.nodes) {
    if (!core.has(node) || ['Button', 'Input', 'Switch'].includes(node)) continue;
    switch (node) {
      case 'Stack':
        parts.push(`      <Stack gap="md" />`);
        break;
      case 'Row':
        parts.push(`      <Row gap="md" align="center" />`);
        break;
      case 'Grid':
        parts.push(`      <Grid min={240} gap="md" />`);
        break;
      case 'Card':
        parts.push(`      <Card pad="lg" />`);
        break;
      case 'Section':
        parts.push(`      <Section />`);
        break;
      case 'Heading':
        parts.push(`      <Heading level={2}>Heading</Heading>`);
        break;
      case 'Text':
        parts.push(`      <Text>Body text</Text>`);
        break;
      case 'Icon':
        parts.push(`      <Icon name="home" />`);
        break;
      case 'Divider':
        parts.push(`      <Divider />`);
        break;
      case 'Badge':
        parts.push(`      <Badge tone="info">Badge</Badge>`);
        break;
      case 'Spinner':
        parts.push(`      <Spinner size="md" />`);
        break;
      case 'Avatar':
        parts.push(`      <Avatar label={data.user.name} />`);
        break;
      case 'Metric':
        parts.push(`      <Metric label="Metric" value={data.user.name} />`);
        break;
      case 'Field':
        parts.push(`      <Field label="Field" value={data.user.name} />`);
        break;
      case 'Select':
        parts.push(`      <Select value={data.form.plan} />`);
        break;
      case 'Checkbox':
        parts.push(`      <Checkbox checked={data.form.remember}>Remember me</Checkbox>`);
        break;
      case 'Alert':
        parts.push(`      <Alert tone="info">Alert</Alert>`);
        break;
      default:
        parts.push(`      <${node} />`);
        break;
    }
  }
  // Def usages.
  if (contract.nodes.includes('StatCard')) parts.push(`      <StatCard label="Revenue" value={data.metrics.revenue} tone="success" />`);
  if (contract.nodes.includes('ListRow')) parts.push(`      <ListRow name="Item" status="Done" />`);
  if (contract.nodes.includes('EmptyCard')) parts.push(`      <EmptyCard icon="home" message="No results" />`);

  const emitted = parts.join('\n');
  for (const b of contract.bindings) {
    if (!emitted.includes(b)) parts.push(`      <Text>{data.${b}}</Text>`);
  }
  for (const t of contract.text) {
    if (!emitted.includes(t)) parts.push(`      <Text>${t}</Text>`);
  }
  parts.push(`    </Stack>`);
  if (contract.nodes.includes('Page')) parts.push(`    </Page>`);
  parts.push(`  );`);
  parts.push(`}`);
  parts.push('');
  return parts.join('\n');
}

/** The design-system/React instructions given to the model in the React condition. */
export const REACT_INSTRUCTIONS: string = 'You are writing React + TypeScript for a design system at "@/components/ui" that exports: Button, Card, Checkbox, Divider, Field, Grid, Heading, Icon, Input, Link, Metric, Row, Section, Select, Spinner, Stack, Switch, Text, Avatar, Badge, Alert, Page. Props use design tokens (gap="md", tone="success", variant="primary"). Data comes from a prop named data (e.g. data.metrics.revenue). Named actions go through onAction(name), and input changes through onAction(name, e.target.value). Third-party charts come from "@acme/charts" (AreaChart, Area, XAxis, CartesianGrid). Write complete, valid TSX for exactly the screen described; do not add explanations.';

/** The AUI skill/spec instructions given to the model in the AUI condition. */
export const AUI_INSTRUCTIONS: string = 'You are writing .aui (AI UI AST), a small indentation-based UI language. Each line is a component with props (key=value), optional label, and optional trailing quoted text. Indentation (exactly 2 spaces per level) means nesting. Data references are $paths resolved against a data object; $item/$index exist inside For loops. Components: Page, Stack, Row, Grid, Card, Section, Spacer, Heading, Text, Image, Icon, Divider, Avatar, Field, Metric, Button, Link, Input, Select, Checkbox, Switch, Alert, Badge, Spinner. Structural: If condition=$x ... Else ..., For each=$items. Actions are named: action=save; semantic events are named: change=emailChanged. Registered third-party charts (AreaChart, Area, XAxis, CartesianGrid) map to "@acme/charts" automatically — never write import lines. def Name param1 param2=default defines a reusable template. Write only the .aui source for exactly the screen described; no explanations, no code fences.';
