import React from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
} from '@mui/material';

/**
 * Reusable styled dialog matching the app's dark aesthetic.
 *
 * Props:
 *   open, onClose, title          — standard dialog control
 *   children                      — dialog body content
 *   onConfirm                     — called when the confirm button is clicked
 *   confirmLabel  (default "Save")
 *   cancelLabel   (default "Cancel")
 *   loading       (default false)  — disables both buttons and shows a spinner
 *   confirmColor  (default "primary")
 *   confirmDisabled (default false)
 *   maxWidth      (default "sm")
 *   actions       — optional JSX that fully replaces the built-in action row
 */
const FormDialog = ({
  open,
  onClose,
  title,
  children,
  onConfirm,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  loading = false,
  confirmColor = 'primary',
  confirmDisabled = false,
  maxWidth = 'sm',
  actions,
}) => (
  <Dialog
    open={open}
    onClose={loading ? undefined : onClose}
    maxWidth={maxWidth}
    fullWidth
    slotProps={{
      paper: {
        sx: {
          bgcolor: '#14141d',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
        },
      },
    }}
  >
    <DialogTitle
      sx={{
        fontWeight: 700,
        fontSize: '0.975rem',
        pt: 2.5,
        pb: 1.5,
        px: 3,
      }}
    >
      {title}
    </DialogTitle>

    <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

    <DialogContent sx={{ pt: 2.5, pb: 2, px: 3 }}>{children}</DialogContent>

    <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />

    <DialogActions sx={{ px: 3, py: 1.75, gap: 1 }}>
      {actions ?? (
        <>
          <Button
            variant="text"
            onClick={onClose}
            disabled={loading}
            sx={{
              color: 'rgba(255,255,255,0.5)',
              '&:hover': { color: '#fff' },
            }}
          >
            {cancelLabel}
          </Button>
          {onConfirm && (
            <Button
              variant="contained"
              color={confirmColor}
              onClick={onConfirm}
              disabled={loading || confirmDisabled}
              startIcon={
                loading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : null
              }
            >
              {confirmLabel}
            </Button>
          )}
        </>
      )}
    </DialogActions>
  </Dialog>
);

export default FormDialog;
