export interface Sample {
  id: string;
  label: string;
  description: string;
  code: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'customer',
    label: 'Customer detail',
    description: 'Profile header, account + usage cards, and a footer action row.',
    code: `Page CustomerDetail data=$customer
  Header
    Row gap=md align=center
      Avatar src=$customer.avatar label=$customer.name
      Stack gap=xs
        Heading level=1 $customer.name
        Badge tone=success $customer.status

  Grid min=280 gap=lg
    Card pad=lg
      Heading level=2 "Account"
      Field label="Email" value=$customer.email
      Field label="Plan" value=$customer.plan

    Card pad=lg
      Heading level=2 "Usage"
      Metric label="Projects" value=$customer.projects
      Metric label="Storage" value=$customer.storage

  Row justify=end gap=sm
    Button variant=secondary action=cancel "Cancel"
    Button variant=primary action=save "Save"`,
  },
  {
    id: 'login',
    label: 'Sign-in form',
    description: 'A centered card with inputs, a checkbox, and a submit action.',
    code: `Page SignIn
  Row justify=center align=center
    Card pad=xl max=sm
      Stack gap=lg
        Stack gap=xs align=center
          Icon name=home
          Heading level=2 "Welcome back"
          Text tone=muted "Sign in to continue to your workspace"

        Stack gap=md
          Input type=email placeholder="you@example.com" value=$form.email
          Input type=password placeholder="••••••••" value=$form.password

        Checkbox checked=$form.remember "Keep me signed in"

        Button variant=primary action=submit size=lg "Sign in"
        Text tone=muted align=center "Forgot your password?"

        Divider
        Text tone=muted align=center "New here? Create an account"`,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Stats, a task list via For, and a conditional empty state.',
    code: `Page Dashboard data=$user
  Stack gap=lg
    Row gap=md align=center justify=between
      Stack gap=xs
        Heading level=1 "Overview"
        Text tone=muted "Welcome back, $user.name"
      Button variant=primary action=new "New project"

    Grid min=240 gap=md
      Card pad=lg
        Metric label="Active projects" value=$user.projects
      Card pad=lg
        Metric label="Notifications" value=$notifications
      Card pad=lg
        Metric label="Team members" value=$items.length

    Section
      Row gap=sm align=center
        Heading level=2 "Recent tasks"
        Badge tone=info $items.length

    If condition=$user.loggedIn
      Card pad=lg
        Stack gap=sm
          For each=$items
            Row gap=md align=center justify=between
              Text $item.name
              Badge tone=success $item.status`,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Toggles, selects, and save/cancel actions in a settings page.',
    code: `Page Settings
  Stack gap=lg
    Heading level=1 "Settings"

    Card pad=lg
      Stack gap=md
        Heading level=2 "Notifications"
        Switch checked=$prefs.email "Email notifications"
        Switch checked=$prefs.push "Push notifications"
        Alert tone=info "You can change these anytime from your profile."

    Card pad=lg
      Stack gap=md
        Heading level=2 "Plan"
        Select value=$customer.plan options="Free,Pro,Team,Enterprise"
        Text tone=muted "Your plan renews on the first of each month."

    Card pad=lg
      Stack gap=md
        Heading level=2 "Danger zone"
        Alert tone=error "Deleting your workspace is permanent."
        Button variant=danger action=delete "Delete workspace"`,
  },
  {
    id: 'pricing',
    label: 'Pricing',
    description: 'A responsive pricing grid with a featured plan.',
    code: `Page Pricing
  Stack gap=lg align=center
    Stack gap=xs align=center
      Heading level=1 "Simple pricing"
      Text tone=muted "Start free. Scale when you grow."

  Grid min=260 gap=md
    Card pad=lg
      Stack gap=md
        Heading level=2 "Starter"
        Text tone=muted "For side projects"
        Heading level=1 "$0"
        Divider
        Text "1 workspace"
        Text "3 projects"
        Text "Community support"
        Button variant=secondary action=start "Get started"

    Card pad=lg
      Stack gap=md
        Badge tone=info "Most popular"
        Heading level=2 "Pro"
        Text tone=muted "For growing teams"
        Heading level=1 "$16"
        Divider
        Text "Unlimited workspaces"
        Text "Unlimited projects"
        Text "Priority support"
        Button variant=primary action=start "Start 14-day trial"

    Card pad=lg
      Stack gap=md
        Heading level=2 "Enterprise"
        Text tone=muted "For large organizations"
        Heading level=1 "Custom"
        Divider
        Text "SSO & audit logs"
        Text "Dedicated success manager"
        Text "99.9% SLA"
        Button variant=secondary action=sales "Contact sales"`,
  },
  {
    id: 'empty',
    label: 'Empty state + loading',
    description: 'Conditional rendering, a spinner, and a friendly empty state.',
    code: `Page Projects
  Stack gap=lg
    Heading level=1 "Projects"
    If condition=$showAdvanced
      Row gap=sm
        Badge tone=warning "Beta"
        Badge tone=info "Advanced mode"
    For each=$projects
      Card pad=lg
        Row gap=md align=center
          Spinner size=sm
          Stack gap=xs
            Heading level=3 $item.name
            Text tone=muted "Progress $item.progress"
    Alert tone=success "All systems operational"`,
  },
];

export const DEFAULT_SAMPLE_ID = 'customer';
