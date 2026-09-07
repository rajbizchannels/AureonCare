import React, { createContext, useContext, useMemo, useState } from 'react';
import type { PatientRow } from '@/lib/api';

/**
 * The patient the clinician is currently working on, shared across tabs.
 *
 * Without this, Chart would need its own patient picker and you would choose
 * the same person twice — once in Patients, once in Chart. Selecting in either
 * place sets it for both, which is what makes a separate Chart tab worth
 * having rather than a second roster.
 */
interface ActivePatientValue {
  patient: PatientRow | null;
  setPatient: (patient: PatientRow | null) => void;
}

const ActivePatientContext = createContext<ActivePatientValue | null>(null);

export const useActivePatient = (): ActivePatientValue => {
  const value = useContext(ActivePatientContext);
  if (!value) throw new Error('useActivePatient must be used inside <ActivePatientProvider>');
  return value;
};

export const ActivePatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const value = useMemo(() => ({ patient, setPatient }), [patient]);
  return <ActivePatientContext.Provider value={value}>{children}</ActivePatientContext.Provider>;
};
