import test from 'node:test';
import assert from 'node:assert/strict';
import {
  can, canAdmin, canPlanCamps, canUseCamps, canWorkCampDesk,
  isClinician, rolePermissions, shellFor,
} from '../src/lib/permissions.ts';

/**
 * These assertions are the contract between the mobile navigation and
 * `frontend/src/utils/rolePermissions.js`. A failure here means the two
 * clients have drifted and a tab is being offered that the server will refuse
 * — or, worse, withheld from someone entitled to it.
 */

test('every role in the matrix declares every module', () => {
  const modules = Object.keys(rolePermissions.admin.modules);
  for (const [role, grants] of Object.entries(rolePermissions)) {
    assert.deepEqual(
      Object.keys(grants.modules).sort(),
      [...modules].sort(),
      `${role} is missing a module`
    );
  }
});

test('an unknown role is granted nothing', () => {
  assert.equal(can(undefined, 'patients'), false);
  assert.equal(can('wizard', 'patients'), false);
  assert.equal(canAdmin('wizard', 'users'), false);
});

test('admin is the only role with the admin switches', () => {
  for (const role of Object.keys(rolePermissions)) {
    assert.equal(canAdmin(role, 'users'), role === 'admin', role);
    assert.equal(canAdmin(role, 'plans'), role === 'admin', role);
  }
});

test('a receptionist has no clinical record access', () => {
  // This is the line that separates the front-desk shell from the clinician
  // one: Chart and Orders are gated on ehr.view.
  assert.equal(can('receptionist', 'ehr'), false);
  assert.equal(can('receptionist', 'clinicalServices'), false);
  // But they run the desk, so appointments and patients are theirs.
  assert.equal(can('receptionist', 'appointments', 'create'), true);
  assert.equal(can('receptionist', 'patients', 'edit'), true);
});

test('a billing manager sees the money and not the chart', () => {
  assert.equal(can('billing_manager', 'rcm', 'edit'), true);
  assert.equal(can('billing_manager', 'claims', 'create'), true);
  assert.equal(can('billing_manager', 'ehr'), false);
  assert.equal(can('billing_manager', 'telehealth'), false);
});

test('nobody but admin may delete a patient', () => {
  for (const role of Object.keys(rolePermissions)) {
    assert.equal(can(role, 'patients', 'delete'), role === 'admin', role);
  }
});

test('view is implied by nothing — create without view never happens', () => {
  for (const [role, grants] of Object.entries(rolePermissions)) {
    for (const [module, actions] of Object.entries(grants.modules)) {
      if (actions.create || actions.edit || actions.delete) {
        assert.equal(actions.view, true, `${role} can act on ${module} without seeing it`);
      }
    }
  }
});

test('shellFor maps each role to exactly one arrangement', () => {
  assert.equal(shellFor('patient'), 'patient');
  assert.equal(shellFor('admin'), 'admin');
  assert.equal(shellFor('doctor'), 'clinician');
  assert.equal(shellFor('nurse'), 'clinician');
  assert.equal(shellFor('receptionist'), 'frontdesk');
  assert.equal(shellFor('billing_manager'), 'frontdesk');
  assert.equal(shellFor('crm_manager'), 'frontdesk');
  assert.equal(shellFor('staff'), 'frontdesk');
  // An unrecognised role still lands somewhere, and it lands on the least
  // privileged staff arrangement rather than on admin.
  assert.equal(shellFor(undefined), 'frontdesk');
});

test('isClinician is doctors and nurses only', () => {
  assert.equal(isClinician('doctor'), true);
  assert.equal(isClinician('nurse'), true);
  assert.equal(isClinician('admin'), false);
  assert.equal(isClinician('receptionist'), false);
});

test('camp gates match the backend authorize() lists', () => {
  // routes/camp-registrations.js: admin, receptionist, doctor, provider, nurse, staff
  for (const role of ['admin', 'receptionist', 'doctor', 'nurse', 'staff']) {
    assert.equal(canWorkCampDesk(role), true, role);
  }
  assert.equal(canWorkCampDesk('billing_manager'), false);
  assert.equal(canWorkCampDesk('patient'), false);

  // routes/camps.js canPlan: admin, receptionist, doctor, provider, nurse
  assert.equal(canPlanCamps('staff'), false);
  assert.equal(canPlanCamps('nurse'), true);
  assert.equal(canPlanCamps('patient'), false);
});

test('patients never reach camps, whatever their appointment grants say', () => {
  assert.equal(can('patient', 'appointments'), true);
  assert.equal(canUseCamps('patient'), false);
  assert.equal(canUseCamps('doctor'), true);
  assert.equal(canUseCamps('billing_manager'), true);
});
