import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

/**
 * Multi-select component specifically for Laboratory CPT codes (80000-89999 range)
 */
const LabCPTMultiSelect = ({ theme, api, value = [], onChange, label, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cptCodes, setCptCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Load CPT codes in 8xxxx range (laboratory procedures)
  useEffect(() => {
    const loadCPTCodes = async () => {
      setLoading(true);
      try {
        // Fetch CPT codes from API, filtering for 8xxxx range (laboratory procedures)
        const codes = await api.getCPTCodes({ codeRange: '80000-89999' });
        setCptCodes(codes);
      } catch (error) {
        console.error('Error loading CPT codes:', error);
        // Fallback to common lab CPT codes if API fails
        setCptCodes([
          { code: '80047', description: 'Basic metabolic panel (Calcium, total)' },
          { code: '80048', description: 'Basic metabolic panel (Calcium, ionized)' },
          { code: '80050', description: 'General health panel' },
          { code: '80053', description: 'Comprehensive metabolic panel' },
          { code: '80061', description: 'Lipid panel' },
          { code: '80069', description: 'Renal function panel' },
          { code: '80074', description: 'Acute hepatitis panel' },
          { code: '80076', description: 'Hepatic function panel' },
          { code: '80162', description: 'Digoxin' },
          { code: '81000', description: 'Urinalysis, by dip stick or tablet reagent' },
          { code: '81001', description: 'Urinalysis, automated with microscopy' },
          { code: '81002', description: 'Urinalysis, non-automated, with microscopy' },
          { code: '81003', description: 'Urinalysis, automated, without microscopy' },
          { code: '81025', description: 'Urine pregnancy test, visual color comparison' },
          { code: '82043', description: 'Albumin; urine' },
          { code: '82247', description: 'Bilirubin; total' },
          { code: '82248', description: 'Bilirubin; direct' },
          { code: '82270', description: 'Blood, occult, by peroxidase activity' },
          { code: '82306', description: 'Vitamin D; 25 hydroxy' },
          { code: '82330', description: 'Calcium; total' },
          { code: '82374', description: 'Carbon dioxide (bicarbonate)' },
          { code: '82465', description: 'Cholesterol, serum or whole blood, total' },
          { code: '82565', description: 'Creatinine; blood' },
          { code: '82570', description: 'Creatinine; urine' },
          { code: '82607', description: 'Vitamin B-12' },
          { code: '82728', description: 'Ferritin' },
          { code: '82746', description: 'Folic acid; serum' },
          { code: '82947', description: 'Glucose; quantitative, blood' },
          { code: '82950', description: 'Glucose; post glucose dose' },
          { code: '82951', description: 'Glucose tolerance test (GTT), 3 specimens' },
          { code: '83036', description: 'Hemoglobin; glycosylated (A1C)' },
          { code: '83540', description: 'Iron' },
          { code: '83550', description: 'Iron binding capacity' },
          { code: '83605', description: 'Lactic acid' },
          { code: '83615', description: 'Lactate dehydrogenase (LD), (LDH)' },
          { code: '83655', description: 'Lead' },
          { code: '83718', description: 'Lipoprotein, direct measurement; high density cholesterol (HDL)' },
          { code: '83719', description: 'Lipoprotein, direct measurement; VLDL cholesterol' },
          { code: '83721', description: 'Lipoprotein, direct measurement; LDL cholesterol' },
          { code: '83735', description: 'Magnesium' },
          { code: '83880', description: 'Natriuretic peptide' },
          { code: '83970', description: 'Parathyroid hormone (PTH)' },
          { code: '84100', description: 'Phosphorus inorganic (phosphate)' },
          { code: '84132', description: 'Potassium; serum, plasma or whole blood' },
          { code: '84133', description: 'Potassium; urine' },
          { code: '84144', description: 'Progesterone' },
          { code: '84153', description: 'Prostate specific antigen (PSA); total' },
          { code: '84154', description: 'Prostate specific antigen (PSA); free' },
          { code: '84155', description: 'Protein, total, except by refractometry; serum, plasma or whole blood' },
          { code: '84156', description: 'Protein, total, except by refractometry; urine' },
          { code: '84295', description: 'Sodium; serum, plasma or whole blood' },
          { code: '84433', description: 'Thyroxine; total' },
          { code: '84436', description: 'Thyroxine; free' },
          { code: '84439', description: 'Thyroid stimulating hormone (TSH)' },
          { code: '84443', description: 'Thyroid stimulating immune globulins (TSI)' },
          { code: '84479', description: 'Thyroid hormone (T3 or T4) uptake' },
          { code: '84480', description: 'Triiodothyronine T3; total' },
          { code: '84481', description: 'Triiodothyronine T3; free' },
          { code: '84520', description: 'Urea nitrogen; quantitative' },
          { code: '84550', description: 'Uric acid; blood' },
          { code: '84702', description: 'Gonadotropin, chorionic (hCG); quantitative' },
          { code: '85004', description: 'Blood count; automated differential WBC count' },
          { code: '85007', description: 'Blood count; manual differential WBC count, buffy coat' },
          { code: '85013', description: 'Blood count; spun microhematocrit' },
          { code: '85014', description: 'Blood count; hematocrit (Hct)' },
          { code: '85018', description: 'Blood count; hemoglobin (Hgb)' },
          { code: '85025', description: 'Blood count; complete (CBC), automated (Hgb, Hct, RBC, WBC and platelet count)' },
          { code: '85027', description: 'Blood count; complete (CBC), automated (Hgb, Hct, RBC, WBC and platelet count) and automated differential WBC count' },
          { code: '85048', description: 'Blood count; leukocyte (WBC), automated' },
          { code: '85610', description: 'Prothrombin time' },
          { code: '85730', description: 'Thromboplastin time, partial (PTT)' },
          { code: '86003', description: 'Allergen specific IgE; quantitative or semiquantitative, crude allergen extract, each' },
          { code: '86140', description: 'C-reactive protein' },
          { code: '86592', description: 'Syphilis test, non-treponemal antibody' },
          { code: '86593', description: 'Syphilis test, treponemal antibody' },
          { code: '86701', description: 'Antibody; HIV-1' },
          { code: '86702', description: 'Antibody; HIV-2' },
          { code: '86703', description: 'Antibody; HIV-1 and HIV-2, single result' },
          { code: '86762', description: 'Antibody; rubella' },
          { code: '86780', description: 'Antibody; Treponema pallidum' },
          { code: '87040', description: 'Culture, bacterial; blood, aerobic, with isolation and presumptive identification' },
          { code: '87045', description: 'Culture, bacterial; stool, aerobic, with isolation and preliminary examination' },
          { code: '87070', description: 'Culture, bacterial; any other source except urine, blood or stool, aerobic' },
          { code: '87086', description: 'Culture, bacterial; quantitative colony count, urine' },
          { code: '87088', description: 'Culture, bacterial; with isolation and presumptive identification, urine' },
          { code: '87205', description: 'Smear, primary source with interpretation; Gram or Giemsa stain for bacteria, fungi, or cell types' },
          { code: '87491', description: 'Chlamydia trachomatis, amplified probe technique' },
          { code: '87591', description: 'Neisseria gonorrhoeae, amplified probe technique' },
          { code: '87798', description: 'Detection of infectious agent by nucleic acid (DNA or RNA); Enterovirus, amplified probe technique' },
          { code: '87880', description: 'Streptococcus, group A, direct probe technique' },
          { code: '88142', description: 'Cytopathology, cervical or vaginal (any reporting system), collected in preservative fluid, automated thin layer preparation' },
          { code: '88175', description: 'Cytopathology, cervical or vaginal (any reporting system), collected in preservative fluid, automated thin layer preparation, requiring interpretation by physician' }
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadCPTCodes();
  }, [api]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCodes = cptCodes.filter(code => {
    const search = searchQuery.toLowerCase();
    return (
      code.code.toLowerCase().includes(search) ||
      code.description.toLowerCase().includes(search)
    );
  });

  const toggleCode = (code) => {
    const isSelected = value.some(c => c.code === code.code);
    if (isSelected) {
      onChange(value.filter(c => c.code !== code.code));
    } else {
      onChange([...value, code]);
    }
  };

  const removeCode = (codeToRemove) => {
    onChange(value.filter(c => c.code !== codeToRemove.code));
  };

  return (
    <div className="w-full">
      {label && (
        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}
        </label>
      )}

      {/* Selected codes */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((code) => (
            <span
              key={code.code}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {code.code} - {code.description.length > 40 ? code.description.substring(0, 40) + '...' : code.description}
              <button
                type="button"
                onClick={() => removeCode(code)}
                className="ml-1 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors flex items-center justify-between ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-600 text-white focus:border-blue-500'
              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
          }`}
        >
          <span className={value.length === 0 ? 'text-gray-500' : ''}>
            {value.length === 0 ? (placeholder || 'Select CPT codes...') : `${value.length} code(s) selected`}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className={`absolute z-50 w-full mt-1 rounded-lg border shadow-lg max-h-96 overflow-hidden ${
            theme === 'dark' ? 'bg-slate-800 border-slate-600' : 'bg-white border-gray-300'
          }`}>
            {/* Search */}
            <div className={`p-2 border-b ${theme === 'dark' ? 'border-slate-600' : 'border-gray-300'}`}>
              <div className="relative">
                <Search className={`absolute left-2 top-2.5 w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by code or description..."
                  className={`w-full pl-8 pr-3 py-2 text-sm border rounded outline-none ${
                    theme === 'dark'
                      ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                      : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
              </div>
            </div>

            {/* Options */}
            <div className="overflow-y-auto max-h-80">
              {loading ? (
                <div className="p-4 text-center text-sm text-gray-500">Loading CPT codes...</div>
              ) : filteredCodes.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No CPT codes found</div>
              ) : (
                filteredCodes.map((code) => {
                  const isSelected = value.some(c => c.code === code.code);
                  return (
                    <button
                      key={code.code}
                      type="button"
                      onClick={() => toggleCode(code)}
                      className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-start gap-2 ${
                        isSelected
                          ? theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                          : theme === 'dark' ? 'hover:bg-slate-700 text-white' : 'hover:bg-gray-100 text-gray-900'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{code.code}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                          {code.description}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabCPTMultiSelect;
