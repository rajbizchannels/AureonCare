import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSession } from '@/context/SessionContext';
import { useActivePatient } from '@/context/ActivePatientContext';
import { ErrorNote, Loading, PrimaryButton } from '@/components/ui';
import { FormRenderer } from '@/components/FormRenderer';
import { ApiError } from '@/lib/api';
import { answersToSend, validate, type FormData, type FormField } from '@/lib/forms';
import { useResource, fullName } from '@/lib/useResource';
import { useLayout } from '@/lib/device';
import { palette, space, type } from '@/theme/tokens';

/**
 * Fill in a form on a phone or tablet.
 *
 *   { submissionId }           a form the practice requested — the patient completes their own
 *                               (portal), or staff complete it for the patient
 *   { templateId, patientId }  staff fill a new form for the patient (e.g. at the desk on a tablet)
 *
 * The answers are checked here with the same rules the server uses (src/lib/forms.ts), then
 * by the server, whose per-question messages are shown next to the questions.
 */
type Params = { submissionId?: string; templateId?: string; patientId?: string };

export const FormFillScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const p = (route.params ?? {}) as Params;
  const { api, account, isPatient, role } = useSession();
  const { patient } = useActivePatient();
  const { gutter, maxContentWidth } = useLayout();
  const [data, setData] = useState<FormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const fillRole = isPatient ? 'patient' : String(role ?? 'staff');

  const form = useResource<{ name: string; fields: FormField[]; editable: boolean; initial: FormData; patientName?: string } | null>(async () => {
    if (p.submissionId && isPatient && account) {
      const d = await api.getPortalFormRequest(account.id, p.submissionId);
      return { name: d.templateName, fields: d.fields, editable: d.editable, initial: (d.submission.form_data as FormData) ?? {} };
    }
    if (p.submissionId) {
      const s = await api.getFormSubmission(p.submissionId);
      const editable = !['submitted', 'reviewed', 'approved', 'completed'].includes(String(s.status));
      return { name: s.template_name_ref ?? s.template_name ?? 'Form', fields: s.template_fields ?? [], editable, initial: (s.form_data as FormData) ?? {}, patientName: s.patient_name ?? undefined };
    }
    if (p.templateId) {
      const t = await api.getFormTemplate(p.templateId);
      return { name: t.name, fields: t.fields ?? [], editable: true, initial: {}, patientName: patient ? fullName(patient.first_name, patient.last_name) : undefined };
    }
    return null;
  }, [api, account?.id, isPatient, p.submissionId, p.templateId]);

  const values = data ?? form.data?.initial ?? {};

  const submit = useCallback(async () => {
    if (!form.data || saving) return;
    const problems = validate(form.data.fields, values, fillRole);
    setErrors(problems);
    if (Object.keys(problems).length) { setError(`Some answers need attention (${Object.keys(problems).length}).`); return; }
    setSaving(true); setError(null);
    const answers = answersToSend(form.data.fields, values, fillRole);
    try {
      if (p.submissionId && isPatient && account) await api.submitPortalForm(account.id, p.submissionId, answers);
      else if (p.submissionId) await api.updateFormSubmission(p.submissionId, { form_data: answers, status: 'submitted' });
      else if (p.templateId) {
        const patientId = p.patientId ?? patient?.id;
        if (!patientId) throw new Error('Choose a patient first.');
        await api.createFormSubmission({ template_id: p.templateId, patient_id: patientId, form_data: answers, status: 'submitted' });
      }
      setDone(true);
    } catch (e) {
      const fe = e instanceof ApiError ? (e.body?.fieldErrors as Record<string, string> | undefined) : undefined;
      if (fe) { setErrors(fe); setError(`Some answers need attention (${Object.keys(fe).length}).`); }
      else setError(e instanceof Error ? e.message : 'Could not submit the form.');
    } finally {
      setSaving(false);
    }
  }, [api, account, form.data, values, fillRole, isPatient, p.submissionId, p.templateId, p.patientId, patient, saving]);

  if (form.loading) return <Loading />;
  if (!form.data) return <View style={{ padding: gutter }}><ErrorNote message={form.error ?? 'This form could not be opened.'} /></View>;

  if (done) {
    return (
      <View style={[styles.doneWrap, { paddingHorizontal: gutter }]}>
        <Text style={styles.doneTitle}>Thank you</Text>
        <Text style={styles.meta}>“{form.data.name}” has been sent to {isPatient ? 'your practice' : 'the patient’s chart'}.</Text>
        <PrimaryButton label="Done" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        scrollEnabled={!drawing}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingHorizontal: gutter, maxWidth: maxContentWidth }]}
      >
        <Text style={styles.title}>{form.data.name}</Text>
        {form.data.patientName && !isPatient ? <Text style={styles.meta}>For {form.data.patientName}</Text> : null}
        {!form.data.editable ? <Text style={styles.meta}>This form has already been completed.</Text> : null}
        {form.data.fields.length === 0 ? (
          <ErrorNote message="This form has no questions to fill in here. Please contact the practice." />
        ) : (
          <FormRenderer
            fields={form.data.fields}
            data={values}
            onChange={(next) => { setData(next); if (Object.keys(errors).length) setErrors({}); if (error) setError(null); }}
            role={fillRole}
            errors={errors}
            readOnly={!form.data.editable}
            onDrawing={setDrawing}
          />
        )}
        {error ? <ErrorNote message={error} /> : null}
        {form.data.editable && form.data.fields.length ? (
          <PrimaryButton label="Submit form" onPress={() => void submit()} busy={saving} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  content: { paddingVertical: space.lg, gap: space.md, width: '100%', alignSelf: 'center', paddingBottom: space.xl * 3 },
  title: { ...type.lg, color: palette.text, fontWeight: '700' },
  meta: { ...type.sm, color: palette.textSecondary },
  doneWrap: { flex: 1, justifyContent: 'center', gap: space.md, backgroundColor: palette.bg },
  doneTitle: { ...type.display, color: palette.text, fontWeight: '700' },
});
