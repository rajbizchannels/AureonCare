import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { X, Cloud, Download, HardDrive, Loader2 } from 'lucide-react';

/**
 * Asks where a backup should go, or which copy to restore.
 *
 * Only shown when there is an actual choice to make: with a single connected
 * provider the caller uploads straight there, and with none it falls back to a
 * local download. Both are decided by the caller, not here.
 *
 * mode 'backup'  — pick a destination
 * mode 'restore' — pick a provider, then a file from it
 */
const BackupDestinationModal = ({
  isOpen,
  onClose,
  onSelect,          // (provider) => void            — backup mode
  onSelectBackup,    // (provider, fileId) => void     — restore mode
  listBackups,       // (provider) => Promise<file[]>  — restore mode
  providers = [],
  mode = 'backup',
  allowLocal = true,
  theme,
  title,
  busy = false,
}) => {
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [error, setError] = useState('');

  const dark = theme === 'dark';

  // Reset whenever the dialog is reopened, so a previous pick does not linger.
  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(null);
      setFiles([]);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const heading = title || (mode === 'restore' ? 'Restore from' : 'Where should this backup go?');

  const chooseProvider = async (provider) => {
    if (mode === 'backup') {
      onSelect?.(provider);
      return;
    }
    setSelectedProvider(provider);
    setLoadingFiles(true);
    setError('');
    try {
      setFiles(await listBackups(provider));
    } catch (err) {
      setError(err.message || 'Could not list backups');
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full max-w-lg rounded-xl border shadow-xl ${
        dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-300'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          dark ? 'border-slate-700' : 'border-gray-200'
        }`}>
          <h3 className={`text-lg font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>
            {heading}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1 rounded transition-colors ${
              dark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/40">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* Step 1 — pick a provider */}
          {!selectedProvider && (
            <>
              {providers.map((p) => (
                <button
                  key={p.provider}
                  type="button"
                  disabled={busy}
                  onClick={() => chooseProvider(p.provider)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors disabled:opacity-60 ${
                    dark
                      ? 'border-slate-700 hover:bg-slate-800 text-white'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <Cloud className={`w-5 h-5 flex-shrink-0 ${dark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                  <span className="font-medium">{p.label}</span>
                </button>
              ))}

              {mode === 'backup' && allowLocal && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSelect?.('local')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors disabled:opacity-60 ${
                    dark
                      ? 'border-slate-700 hover:bg-slate-800 text-white'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <Download className={`w-5 h-5 flex-shrink-0 ${dark ? 'text-slate-400' : 'text-gray-500'}`} />
                  <span className="font-medium">Download to this computer</span>
                </button>
              )}

              {mode === 'restore' && providers.length === 0 && (
                <p className={`text-sm ${dark ? 'text-slate-400' : 'text-gray-600'}`}>
                  No cloud destination is connected. Connect Google Drive or OneDrive in
                  Backup Settings to restore from one.
                </p>
              )}
            </>
          )}

          {/* Step 2 — pick a file (restore only) */}
          {selectedProvider && (
            <>
              {loadingFiles && (
                <div className={`flex items-center gap-2 py-6 justify-center ${
                  dark ? 'text-slate-400' : 'text-gray-600'
                }`}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading backups…</span>
                </div>
              )}

              {!loadingFiles && files.length === 0 && !error && (
                <p className={`text-sm py-4 ${dark ? 'text-slate-400' : 'text-gray-600'}`}>
                  No backups found in this account.
                </p>
              )}

              {!loadingFiles && files.map((f) => (
                <button
                  key={f.fileId}
                  type="button"
                  disabled={busy}
                  onClick={() => onSelectBackup?.(selectedProvider, f.fileId)}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-colors disabled:opacity-60 ${
                    dark
                      ? 'border-slate-700 hover:bg-slate-800 text-white'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <HardDrive className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    dark ? 'text-slate-400' : 'text-gray-500'
                  }`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{f.fileName}</span>
                    <span className={`block text-xs ${dark ? 'text-slate-500' : 'text-gray-500'}`}>
                      {[formatWhen(f.createdAt), formatSize(f.sizeBytes)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => { setSelectedProvider(null); setFiles([]); setError(''); }}
                className={`text-sm underline ${dark ? 'text-slate-400' : 'text-gray-600'}`}
              >
                Choose a different account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

BackupDestinationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func,
  onSelectBackup: PropTypes.func,
  listBackups: PropTypes.func,
  providers: PropTypes.array,
  mode: PropTypes.oneOf(['backup', 'restore']),
  allowLocal: PropTypes.bool,
  theme: PropTypes.string,
  title: PropTypes.string,
  busy: PropTypes.bool,
};

export default BackupDestinationModal;
