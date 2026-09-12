import  { useState } from 'react';
import {
  Alert,
  Typography,
} from '@mui/material';
import { useAlert } from '../../contexts/AlertContext';
import FormDialog from '../FormDialog';
import { deleteOverlay } from '../../api/overlayApi';


const DeleteDialog = ({ open, onClose, overlay, onDeleted }) => {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await deleteOverlay(overlay.id);
      showAlert({
        message: `Overlay "${overlay.name}" deleted`,
        severity: 'success',
      });
      onDeleted();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Delete Overlay"
      onConfirm={handleDelete}
      confirmLabel="Delete"
      confirmColor="error"
      loading={loading}
      maxWidth="xs"
    >
      <Typography>
        Delete <strong>{overlay?.name}</strong>? The route{' '}
        <code>{overlay?.route_path}</code> will stop serving.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </FormDialog>
  );
};
export default DeleteDialog;