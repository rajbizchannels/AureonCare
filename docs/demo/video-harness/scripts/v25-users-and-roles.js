/**
 * V25 — Add users and control what they can see.
 * The two independent gates: subscription plan, and role.
 */

module.exports = {
  id: 'V25',
  wave: 4,
  slug: 'v25-add-users-and-control-access',
  title: 'Add users and control what they can see',
  thumbHeadline: 'Users & roles',
  moduleLabel: 'Settings ▸ Access Control',
  audience: 'Admin',
  intro: 'Two gates decide what a person sees: the plan you are on, and the role you gave them.',
  journey: 'User Management → add a user → Roles & Permissions → module permissions → Subscription Plans',
  youtubeTitle: 'AureonCare: Add Users and Control What They Can See',
  description:
    'User and role administration in AureonCare. Adds a user, assigns a role, then walks the '
    + 'Roles & Permissions matrix — including the fine-grained Accounts and Inventory permissions — '
    + 'and explains the two independent gates that answer "why can\'t I see this module": your '
    + 'subscription plan, and the role.\n\nPart of the AureonCare training series.',
  tags: [
    'AureonCare', 'user management', 'role based access control', 'RBAC healthcare',
    'clinic staff permissions', 'practice management software', 'HIPAA access control',
    'user roles', 'healthcare software admin', 'least privilege',
  ],
  recap: [
    'A role is a bundle of permissions — give the narrowest one that still works',
    'Module permissions go finer: view, create, edit, delete, approve, export',
    'Plan gates the module, role gates the person — both have to allow it',
  ],

  async run(d, page) {
    d.chapter('The people');
    await d.step('Step 1 — User Management');
    await d.nav('Settings', 'User Management');
    await d.say(
      'Settings ▸ <b>User Management</b> is everyone with a sign-in, and the role each of them carries.',
      4400
    );

    await d.step('Step 2 — Add a user');
    const addUser = page.getByRole('button', { name: /Add User/i }).first();
    if (await d.exists(addUser, 5000)) await d.click(addUser, { pause: 2000 });

    // The form opens inline on the page rather than in a modal, so the fields
    // are addressed by their own placeholders.
    const first = page.getByPlaceholder('John').first();
    if (await d.exists(first, 5000)) await d.type(first, 'Priya', { delay: 50 });
    const last = page.getByPlaceholder('Doe').first();
    if (await d.exists(last, 3000)) await d.type(last, 'Raghavan', { delay: 50 });
    const email = page.getByPlaceholder('email@example.com').first();
    if (await d.exists(email, 3000)) await d.type(email, 'priya.raghavan@demo-clinic.example', { delay: 22 });
    await d.say(
      'A new user needs a name, a work email and a <b>role</b> — the role is the part that decides what they see.',
      4800
    );

    await d.scrollBy(700);
    const roleSelect = page.locator('select').last();
    if (await d.exists(roleSelect, 3000)) await d.select(roleSelect, 'staff').catch(() => {});
    await d.say(
      'Give the narrowest role that still lets them do the job. Widening one later is easy; unwinding an over-wide one is not.',
      5000
    );
    const pw = page.getByPlaceholder('Enter password').first();
    if (await d.exists(pw, 3000)) await d.type(pw, 'Sunrise-Harbor-24', { delay: 30 });
    const pw2 = page.getByPlaceholder('Confirm password').first();
    if (await d.exists(pw2, 3000)) await d.type(pw2, 'Sunrise-Harbor-24', { delay: 30 });
    const submit = page.getByRole('button', { name: /^Create$/i }).first();
    if (await d.exists(submit, 4000)) await d.click(submit, { pause: 2800 });
    await d.say(
      'They sign in with that once and set their own — you are not the keeper of anybody&rsquo;s password.',
      4400
    );

    d.chapter('What each role can do');
    await d.step('Step 3 — Roles & Permissions');
    await d.nav('Settings', 'Roles & Permissions');
    await d.say(
      '<b>Roles &amp; Permissions</b> is the whole matrix on one screen: <b>V</b>iew, <b>C</b>reate, <b>E</b>dit, <b>D</b>elete, per module.',
      5000
    );
    await d.say(
      'Admin is protected — it always keeps everything, so you can never lock yourself out.',
      4200
    );
    await d.say(
      'A doctor can view and create claims but not delete them. Staff never reach Settings or Backup at all.',
      4600
    );

    await d.step('Step 4 — Finer than the module');
    await d.scrollBy(600);
    await d.say(
      'Accounting and Inventory go finer still: per resource, and with <b>approve</b> and <b>export</b> as their own permissions.',
      5000
    );
    await d.say(
      'That is how a billing manager can approve a payable while nobody else can — and why exports are worth guarding.',
      4800
    );

    d.chapter('The other gate');
    await d.step('Step 5 — Subscription Plans');
    await d.nav('Settings', 'Subscription Plans');
    await d.say(
      'There is a second gate: your <b>plan</b>. Modules outside it are hidden from everyone, whatever their role.',
      4800
    );
    await d.say(
      'So "why can&rsquo;t I see this" has exactly two answers — the plan does not include it, or the role does not allow it.',
      5000
    );
    await d.step('');
  },
};
