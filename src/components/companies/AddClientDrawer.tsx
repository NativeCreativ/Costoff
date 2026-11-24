'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { CompanyForm, type CompanyFormValues, type CompanyFormHandle } from './CompanyForm';
import { companyFormSchema } from './company.schema';
import { useCreateCompanyMutation } from '@/queries/companies/useCompanyMutations';
import { companyFormValuesToPayload, companyRoundsToPayload } from '@/lib/companies/companyFormPayload';
import { useQueryClient } from '@tanstack/react-query';
import type { ConfiguredRound } from '@/services/interviewRound.service';
import { isAxiosError } from 'axios';
import { useModalDrawerSlot } from '@/components/ui/Modal';

interface AddClientDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Called when the drawer should close (after exit animation) */
  onClose: () => void;
  /** The demand's current Account Manager (to prefill the drawer's AM field) */
  demandAccountManagerId?: string | null;
  /** Callback when a company is successfully created/selected */
  onCompanySaved: (company: { id: string; name: string; client_name?: string | null }) => void;
  /** Current user role for permission checks */
  currentUserRole?: string;
}

const EMPTY_FORM: CompanyFormValues = {
  name: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  state: '',
  country: '',
  other_details: '',
  status: 'ACTIVE',
  max_submissions_per_position: 5,
  spocs: [],
};

export function AddClientDrawer({
  isOpen,
  onClose,
  onCompanySaved,
  currentUserRole,
}: AddClientDrawerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateCompanyMutation();
  const drawerSlot = useModalDrawerSlot();

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingCompany, setExistingCompany] = useState<{ id: string; name: string; client_name?: string | null } | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const isDirtyRef = useRef(false);
  const formRef = useRef<CompanyFormHandle | null>(null);

  // Animation state: 'closed' | 'opening' | 'open' | 'closing'
  const [animationState, setAnimationState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');

  // Animation state management
  useEffect(() => {
    if (isOpen) {
      setAnimationState('opening');
      requestAnimationFrame(() => {
        setAnimationState('open');
      });
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (animationState !== 'closed') {
      setAnimationState('closing');
    }
  }, [isOpen]);

  // Handle animation end - call onClose after exit animation completes
  useEffect(() => {
    if (animationState === 'closing') {
      const timer = setTimeout(() => {
        setAnimationState('closed');
        onClose();
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
          previousActiveElement.current = null;
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [animationState, onClose]);

  // Handle dirty state from CompanyForm
  const handleDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

  // Check prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleSubmit = async (values: CompanyFormValues, _currentRounds: ConfiguredRound[]) => {
    // Validate form (schema validation already passed via react-hook-form)
    setSubmitting(true);
    setError(null);

    try {
      const payload = companyFormValuesToPayload(values);
      // No rounds sent from the drawer - company created without rounds
      // The demand will seed its rounds into the company on save if the company has none

      const created = await createMutation.mutateAsync(payload);

      // Success - optimistically add the new company to the query cache so the Client dropdown shows it immediately
      // The CompanySelect uses queryKey: ['companies', search, COMPANY_ACTIVE_STATUS] where search='' initially
      // and COMPANY_ACTIVE_STATUS='ACTIVE'. We update this exact key.
      const activeStatus = 'ACTIVE';
      const cacheKey = ['companies', '', activeStatus];
      
      queryClient.setQueryData(cacheKey, (old: any) => {
        const newCompany = {
          id: created.id,
          name: created.name,
          client_name: created.client_name,
          city: null,
          country: null,
          status: 'ACTIVE',
          _count: { demands: 0 },
          created_by_name: null,
          spoc_name: null,
          spoc_email: null,
        };
        if (!old) {
          // Query not yet fetched - create initial cache entry
          return {
            data: [newCompany],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          };
        }
        // Check if already exists (by id)
        if (old.data?.some?.((c: any) => c.id === created.id)) return old;
        return {
          ...old,
          data: [newCompany, ...(old.data || [])],
          total: (old.total || 0) + 1,
        };
      });

      // Also set the individual company query cache for the currentCompanyQuery in CompanySelect
      queryClient.setQueryData(['company', created.id], {
        id: created.id,
        name: created.name,
        client_name: created.client_name,
        email: '',
        phone: '',
        website: '',
        address: '',
        city: '',
        state: '',
        country: '',
        status: 'ACTIVE',
        spoc_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _count: { demands: 0 },
        created_by_name: null,
        spoc_name: null,
        spoc_email: null,
      });

      // Success - immediately start closing the drawer (reset dirty first so no discard dialog)
      isDirtyRef.current = false;
      setAnimationState('closing');

      // Fire-and-forget: invalidate queries and show toast without blocking the close
      // The optimistic updates above will show immediately; invalidation refetches in background
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['interview-rounds-master'] });

      toast.success('Client created', `"${created.name}" has been added to the Company Master.`);
      onCompanySaved({ id: created.id, name: created.name, client_name: created.client_name });
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        const existing = err.response?.data?.existingCompany;
        if (existing) {
          setExistingCompany({ id: existing.id, name: existing.name, client_name: existing.client_name });
          setShowDuplicateDialog(true);
        } else {
          const msg = err.response?.data?.error || 'A company with that name already exists.';
          setError(msg);
          toast.error('Client not created', msg);
        }
      } else {
        const msg = isAxiosError(err)
          ? err.response?.data?.error || 'Failed to create company'
          : 'Failed to create company';
        setError(msg);
        toast.error('Client not created', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectExisting = () => {
    if (existingCompany) {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['interview-rounds-master'] });
      toast.info('Existing client selected', `"${existingCompany.name}" was selected.`);
      onCompanySaved(existingCompany);
    }
    setShowDuplicateDialog(false);
    setExistingCompany(null);
  };

  // Request to close the drawer - shows discard dialog if dirty
  const requestClose = useCallback(() => {
    if (isDirtyRef.current) {
      setShowDiscardDialog(true);
    } else {
      // Close immediately
      setAnimationState('closing');
    }
  }, []);

  const confirmDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    isDirtyRef.current = false;
    // Reset form if we have access
    if (formRef.current) {
      formRef.current.reset();
    }
    setAnimationState('closing');
  }, []);

  const cancelDiscard = useCallback(() => {
    setShowDiscardDialog(false);
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showDiscardDialog) {
        cancelDiscard(); // Esc on dialog = continue editing
      } else if (showDuplicateDialog) {
        setShowDuplicateDialog(false);
      } else {
        requestClose();
      }
    }
  }, [showDiscardDialog, showDuplicateDialog, requestClose, cancelDiscard]);

  // Render nothing if closed and not animating
  if (animationState === 'closed') return null;

  // Animation classes
  const isOpenState = animationState === 'open' || animationState === 'opening';
  const translateX = (isOpenState && !prefersReducedMotion) ? 'translateX(0)' : 'translateX(100%)';
  const opacity = isOpenState ? 1 : 0;
  const backdropOpacity = isOpenState ? 0.3 : 0;
  const transitionDuration = prefersReducedMotion ? '0ms' : '250ms';

  const drawerStyles: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '60%',
    maxWidth: '65%',
    minWidth: '380px',
    maxHeight: '100%',
    transform: translateX,
    opacity,
    transition: `transform ${transitionDuration} ease-out, opacity ${transitionDuration} ease-out`,
    zIndex: 50,
    boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
  };

  const backdropStyles: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0)',
    opacity: backdropOpacity,
    transition: `opacity ${transitionDuration} ease-out`,
    pointerEvents: isOpenState ? 'auto' : 'none',
  };

  const drawerContent = (
    <div
      className="flex h-full"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop - click to close (with discard check) */}
      <div
        style={backdropStyles}
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Drawer panel - right anchored, full height, ~60-65% width */}
      <div
        style={drawerStyles}
        className="flex flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-4 border-b border-[#e2e8f0] shrink-0">
          <div>
            <h2 id="drawer-title" className="text-lg font-semibold text-[#0f172a]">Add New Client</h2>
            <p className="mt-0.5 text-sm text-[#64748b]">
              Company master record. Saved to Clients Master and selected in this demand.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={requestClose}
            disabled={submitting}
            className="shrink-0 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {showDuplicateDialog && (
            <div className="mb-4 p-3 rounded-md border border-[#fca5a5] bg-[#fef2f2]">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#dc2626]" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#dc2626]">A client with this name already exists.</p>
                  <p className="mt-1 text-sm text-[#991b1b]">
                    <strong>{existingCompany?.name}</strong> is already in the Company Master.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDuplicateDialog(false)}
                    >
                      Enter a different name
                    </Button>
                    <Button size="sm" onClick={handleSelectExisting}>
                      Select existing client
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && !showDuplicateDialog && (
            <div className="mb-4 p-3 rounded-md border border-[#fca5a5] bg-[#fef2f2] text-sm text-[#dc2626]">
              {error}
            </div>
          )}

          <CompanyForm
            ref={formRef}
            defaultValues={EMPTY_FORM}
            initialRounds={[]}
            onSubmit={handleSubmit}
            onCancel={requestClose}
            submitLabel="Save Client"
            pendingLabel="Saving…"
            isSubmitting={submitting}
            hideActions
            formId="add-client-drawer-form"
            onValidationError={(message) => setError(message)}
            onDirtyChange={handleDirtyChange}
            showRounds={false}
          />
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-[#e2e8f0] shrink-0 bg-white/95 backdrop-blur-sm">
          <span className="text-xs text-[#94a3b8] font-medium px-2 py-1 rounded bg-[#f1f5f9]">
            Add interview rounds in the demand form
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-client-drawer-form"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Save and select client
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Discard dialog - absolute positioned within the modal frame (same as drawer), higher z-index
  const discardDialogContent = showDiscardDialog ? (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="discard-title"
      aria-describedby="discard-desc"
    >
      <div className="relative w-full max-w-md mx-4 bg-white rounded-[10px] border border-[#e2e8f0] p-5 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] animate-in fade-in-0 zoom-in-95">
        <div className="mb-1">
          <h3 id="discard-title" className="text-lg font-semibold text-[#0f172a]">Discard changes?</h3>
        </div>
        <p id="discard-desc" className="mb-4 text-sm text-[#475569]">
          You have unsaved changes in this client.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={cancelDiscard}
            autoFocus
          >
            Continue editing
          </Button>
          <Button
            type="button"
            onClick={confirmDiscard}
            className="bg-[#dc2626] hover:bg-[#b91c1c]"
          >
            Discard changes
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  // Portal both drawer and dialog to the modal's drawer slot (outer frame)
  const slotContent = (
    <>
      {drawerContent}
      {discardDialogContent}
    </>
  );

  if (drawerSlot) {
    return createPortal(slotContent, drawerSlot);
  }

  // Fallback: render inline (should not happen in practice since drawer is only used inside Modal)
  return slotContent;
}