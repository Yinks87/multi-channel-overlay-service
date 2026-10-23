import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteIcon from '@mui/icons-material/Delete';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import {
  createFolder,
  deleteFile,
  listFiles,
  moveFile,
  uploadFiles,
} from '../api/filesApi';
import { useAlert } from '../contexts/AlertContext';

const CONFLICT_MODES = [
  { value: 'reject', label: 'Ask if exists' },
  { value: 'overwrite', label: 'Overwrite files' },
  { value: 'replace', label: 'Replace folders/files' },
];

const joinPath = (...parts) => parts.filter(Boolean).join('/');

const formatSize = (bytes) => {
  if (bytes === null || bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const FileManager = () => {
  const { showAlert } = useAlert();
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [progress, setProgress] = useState(null);
  const [conflictMode, setConflictMode] = useState('reject');

  const [pendingUpload, setPendingUpload] = useState(null); // files waiting for a conflict decision
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  useEffect(() => {
    // webkitdirectory is not a typed React prop
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState(null);
  const load = () => setReloadKey((k) => k + 1);
  const requestKey = `${path}#${reloadKey}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    listFiles(path)
      .then((data) => !cancelled && setEntries(data.entries))
      .catch((e) => {
        if (cancelled) return;
        setEntries([]);
        showAlert({ message: e.message, severity: 'error' });
      })
      .finally(() => !cancelled && setLoadedKey(requestKey));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);
  const runUpload = async (files, conflict) => {
    setProgress(0);
    try {
      const result = await uploadFiles(files, {
        path,
        conflict,
        onProgress: setProgress,
      });
      showAlert({ message: `Uploaded ${result.uploaded.length} file(s)` });
      setPendingUpload(null);
      load();
    } catch (e) {
      if (conflict === 'reject' && e.message === 'Some files already exist') {
        setPendingUpload(files);
      } else {
        setPendingUpload(null);
        showAlert({ message: e.message, severity: 'error' });
      }
    } finally {
      setProgress(null);
    }
  };

  const handlePick = (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) runUpload(files, conflictMode);
  };

  const handleCreateFolder = async () => {
    try {
      await createFolder(joinPath(path, newFolderName.trim()));
      setFolderDialogOpen(false);
      setNewFolderName('');
      load();
    } catch (e) {
      showAlert({ message: e.message, severity: 'error' });
    }
  };

  const handleRename = async () => {
    try {
      await moveFile(
        joinPath(path, renameTarget.name),
        joinPath(path, renameValue.trim()),
      );
      setRenameTarget(null);
      load();
    } catch (e) {
      showAlert({ message: e.message, severity: 'error' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteFile(joinPath(path, deleteTarget.name));
      showAlert({ message: `Deleted ${deleteTarget.name}` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      showAlert({ message: e.message, severity: 'error' });
    }
  };

  const segments = path.split('/').filter(Boolean);
  const uploading = progress !== null;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        File Manager
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<UploadFileIcon />}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload files
        </Button>
        <Button
          variant="contained"
          startIcon={<FolderOpenIcon />}
          disabled={uploading}
          onClick={() => folderInputRef.current?.click()}
        >
          Upload folder
        </Button>
        <Button
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          onClick={() => setFolderDialogOpen(true)}
        >
          New folder
        </Button>
        <TextField
          select
          size="small"
          label="If target exists"
          value={conflictMode}
          onChange={(e) => setConflictMode(e.target.value)}
          sx={{ minWidth: 190 }}
        >
          {CONFLICT_MODES.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>
        <Tooltip title="Refresh">
          <IconButton onClick={load}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={handlePick}
        />
        <input ref={folderInputRef} type="file" hidden onChange={handlePick} />
      </Box>

      {uploading && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mb: 2, height: 6, borderRadius: 3 }}
        />
      )}

      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" underline="hover" onClick={() => setPath('')}>
          root
        </Link>
        {segments.map((seg, i) => {
          const target = segments.slice(0, i + 1).join('/');
          return i === segments.length - 1 ? (
            <Typography key={target} color="text.primary">
              {seg}
            </Typography>
          ) : (
            <Link
              key={target}
              component="button"
              underline="hover"
              onClick={() => setPath(target)}
            >
              {seg}
            </Link>
          );
        })}
      </Breadcrumbs>

      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell>Modified</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={22} />
                </TableCell>
              </TableRow>
            ) : (
              <>
                {segments.length > 0 && (
                  <TableRow
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setPath(segments.slice(0, -1).join('/'))}
                  >
                    <TableCell colSpan={4}>..</TableCell>
                  </TableRow>
                )}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      This folder is empty
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((entry) => {
                  const isDir = entry.type === 'directory';
                  return (
                    <TableRow
                      key={entry.name}
                      hover
                      sx={{ cursor: isDir ? 'pointer' : 'default' }}
                      onClick={() => isDir && setPath(joinPath(path, entry.name))}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {isDir ? (
                            <FolderIcon fontSize="small" color="primary" />
                          ) : (
                            <InsertDriveFileIcon fontSize="small" />
                          )}
                          {entry.name}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{formatSize(entry.size)}</TableCell>
                      <TableCell>
                        {new Date(entry.modifiedAt).toLocaleString()}
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Rename / move">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setRenameTarget(entry);
                              setRenameValue(entry.name);
                            }}
                          >
                            <DriveFileMoveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Conflict decision */}
      <Dialog open={!!pendingUpload} onClose={() => setPendingUpload(null)}>
        <DialogTitle>Files already exist</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Some of the selected files already exist in this folder.
            <br />
            <b>Overwrite</b> replaces matching files and keeps everything else.
            <br />
            <b>Replace</b> deletes the existing folder/file with the same
            top-level name first, so no old files remain.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingUpload(null)}>Cancel</Button>
          <Button onClick={() => runUpload(pendingUpload, 'overwrite')}>
            Overwrite
          </Button>
          <Button
            color="warning"
            onClick={() => runUpload(pendingUpload, 'replace')}
          >
            Replace
          </Button>
        </DialogActions>
      </Dialog>

      {/* New folder */}
      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)}>
        <DialogTitle>New folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && newFolderName.trim() && handleCreateFolder()
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
          <Button disabled={!newFolderName.trim()} onClick={handleCreateFolder}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)}>
        <DialogTitle>Rename / move</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Path relative to the current folder. Use / to move into another
            folder.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="New name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && renameValue.trim() && handleRename()
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button
            disabled={!renameValue.trim() || renameValue === renameTarget?.name}
            onClick={handleRename}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete {deleteTarget?.type}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <b>{deleteTarget?.name}</b>
            {deleteTarget?.type === 'directory' &&
              ' and everything inside it'}{' '}
            will be permanently deleted from the server. Overlays using these
            files may stop working.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FileManager;
