/**
 * Hand-written React implementations of the six gallery screens.
 *
 * These are the "what a developer would actually ship" counterparts to the
 * `.aui` sources in `gallery.ts`. They were authored by hand for the token
 * validation script (`scripts/validate-tokens.ts`): same screens, same data
 * bindings, same actions — but written the way React is really written, with
 * imports, component definitions, handlers, and JSX plumbing. The token
 * counts on the Examples page compare `.aui` against these.
 *
 * Keep them honest: realistic but not padded. Every binding and action in the
 * `.aui` version must appear here.
 */

export const HANDWRITTEN: Record<string, string> = {
  imports: `import { AreaChart, Area, XAxis, CartesianGrid } from '@acme/charts';
import { Badge, Button, Card, Heading, Row, Stack, Text } from '@/components/ui';

export function Revenue({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <div className="page">
      <Stack gap="lg">
        <Row gap="md" align="center" justify="between">
          <Stack gap="xs">
            <Heading level={1}>Revenue overview</Heading>
            <Text tone="muted">Monthly recurring revenue, last 6 months</Text>
          </Stack>
          <Row gap="sm" align="center">
            <Badge tone="success">Live</Badge>
            <Button variant="secondary" onClick={() => onAction('export')}>
              Export
            </Button>
          </Row>
        </Row>

        <Card pad="lg">
          <Heading level={2}>MRR</Heading>
          <AreaChart data={data.metrics.series} height={280}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <Area dataKey="revenue" stroke="#a78bfa" fill="#a78bfa" />
          </AreaChart>
        </Card>
      </Stack>
    </div>
  );
}
`,

  components: `import { Card, Grid, Heading, Stack, Text } from '@/components/ui';

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'info' | 'success' | 'warning' | 'error';
}) {
  return (
    <Card pad="lg">
      <Stack gap="xs">
        <Text tone="muted">{label}</Text>
        <Heading level={2} tone={tone}>
          {value}
        </Heading>
      </Stack>
    </Card>
  );
}

export function Metrics({ data }: { data: any }) {
  return (
    <div className="page">
      <Grid min={220} gap="md">
        <StatCard label="Revenue" value={data.metrics.revenue} tone="success" />
        <StatCard label="Active users" value={data.metrics.active} tone="info" />
        <StatCard label="Churn rate" value={data.metrics.churn} tone="warning" />
        <StatCard label="Projects" value={data.customer.projects} />
      </Grid>
    </div>
  );
}
`,

  logic: `import { Avatar, Badge, Button, Card, Divider, Heading, Row, Stack, Text } from '@/components/ui';

export function Account({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <div className="page">
      {data.user.loggedIn ? (
        <Card pad="lg">
          <Stack gap="md">
            <Row gap="md" align="center">
              <Avatar label={data.user.name} />
              <Stack gap="xs">
                <Heading level={2}>{data.user.name}</Heading>
                <Badge tone="success">Online</Badge>
              </Stack>
            </Row>
            <Divider />
            <Button variant="primary" onClick={() => onAction('signOut')}>
              Sign out
            </Button>
          </Stack>
        </Card>
      ) : (
        <Card pad="lg">
          <Stack gap="md">
            <Heading level={2}>Sign in to continue</Heading>
            <Text tone="muted">Your workspace is waiting.</Text>
            <Button variant="primary" onClick={() => onAction('signIn')}>
              Sign in
            </Button>
          </Stack>
        </Card>
      )}
    </div>
  );
}
`,

  business: `import { Alert, Button, Card, Checkbox, Divider, Heading, Input, Row, Stack, Text } from '@/components/ui';

export function Checkout({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onAction(field + ':' + e.target.value);

  return (
    <div className="page">
      <Card pad="lg">
        <Stack gap="md">
          <Heading level={2}>Checkout</Heading>
          <Text tone="muted">One-time payment · Pro plan</Text>
          <Divider />
          <Stack gap="md">
            <Input type="email" placeholder="Email" value={data.form.email} onChange={handleChange('email')} />
            <Input type="text" placeholder="Card number" value={data.form.card} onChange={handleChange('card')} />
            <Row gap="md">
              <Input type="text" placeholder="MM / YY" value={data.form.expiry} onChange={handleChange('expiry')} />
              <Input type="text" placeholder="CVC" value={data.form.cvc} onChange={handleChange('cvc')} />
            </Row>
            <Checkbox checked={data.form.remember}>Save card for next time</Checkbox>
          </Stack>
          <Alert tone="warning">Test mode — no real charge will be made.</Alert>
          <Button variant="primary" size="lg" onClick={() => onAction('pay')}>
            Pay $129.00
          </Button>
        </Stack>
      </Card>
    </div>
  );
}
`,

  'live-data': `import { AreaChart, Area, XAxis, CartesianGrid } from '@acme/charts';
import { Avatar, Badge, Button, Card, Grid, Heading, Row, Section, Stack, Text } from '@/components/ui';

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card pad="lg">
      <Stack gap="xs">
        <Text tone="muted">{label}</Text>
        <Heading level={2} tone={tone}>
          {value}
        </Heading>
      </Stack>
    </Card>
  );
}

export function LiveDashboard({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <div className="page">
      <Stack gap="lg">
        <Row gap="md" align="center" justify="between">
          <Stack gap="xs">
            <Heading level={1}>Live overview</Heading>
            <Badge tone="success">Streaming</Badge>
          </Stack>
          <Button variant="secondary" onClick={() => onAction('refresh')}>
            Refresh
          </Button>
        </Row>

        <Grid min={220} gap="md">
          <StatCard label="Revenue" value={data.metrics.revenue} tone="success" />
          <StatCard label="Users" value={data.metrics.users} tone="info" />
          <StatCard label="Churn" value={data.metrics.churn} tone="warning" />
        </Grid>

        <Card pad="lg">
          <Heading level={2}>Revenue trend</Heading>
          <AreaChart data={data.metrics.series} height={240}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <Area dataKey="revenue" stroke="#a78bfa" fill="#a78bfa" />
          </AreaChart>
        </Card>

        <Section>
          <Heading level={2}>Recent signups</Heading>
          {data.items.map((item) => (
            <Row key={item.id} gap="md" align="center" justify="between">
              <Row gap="sm" align="center">
                <Avatar label={item.name} />
                <Text>{item.name}</Text>
              </Row>
              <Badge tone="info">{item.status}</Badge>
            </Row>
          ))}
        </Section>
      </Stack>
    </div>
  );
}
`,

  composition: `import { AreaChart, Area } from '@acme/charts';
import { Button, Card, Grid, Heading, Row, Stack, Switch, Text } from '@/components/ui';

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Card pad="lg">
      <Stack gap="xs">
        <Text tone="muted">{label}</Text>
        <Heading level={2} tone={tone}>
          {value}
        </Heading>
      </Stack>
    </Card>
  );
}

export function Billing({ data, onAction }: { data: any; onAction: (name: string) => void }) {
  return (
    <div className="page">
      <Stack gap="lg">
        <Row gap="md" align="center" justify="between">
          <Stack gap="xs">
            <Heading level={1}>Billing</Heading>
            <Text tone="muted">Manage your workspace plan and invoices</Text>
          </Stack>
          <Button variant="primary" onClick={() => onAction('upgrade')}>
            Upgrade
          </Button>
        </Row>

        <Grid min={220} gap="md">
          <StatCard label="Current plan" value={data.plan.tier} tone="info" />
          <StatCard label="Renews" value={data.plan.renewsAt} />
          <StatCard label="Seats" value={String(data.items.length)} />
        </Grid>

        {data.user.role ? (
          <Card pad="lg">
            <Stack gap="md">
              <Heading level={2}>Admin controls</Heading>
              <Switch checked={data.prefs.email}>Email alerts</Switch>
              <Row gap="sm">
                <Button variant="secondary" onClick={() => onAction('invoices')}>
                  View invoices
                </Button>
                <Button variant="danger" onClick={() => onAction('cancel')}>
                  Cancel subscription
                </Button>
              </Row>
            </Stack>
          </Card>
        ) : (
          <Card pad="lg">
            <Stack gap="md">
              <Heading level={2}>Usage</Heading>
              <AreaChart data={data.metrics.series} height={180}>
                <Area dataKey="users" stroke="#34d399" fill="#34d399" />
              </AreaChart>
            </Stack>
          </Card>
        )}
      </Stack>
    </div>
  );
}
`,
};
