import React, { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FolderIcon from '@mui/icons-material/Folder';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import StorageIcon from '@mui/icons-material/Storage';
import {
  fetchTables,
  deleteTable,
  fetchAllTables,
  fetchTableGroups,
} from '../api/customTablesApi';
import { useAlert } from '../contexts/AlertContext';
import CreateTableDialog from '../components/dbManager/CreateTableDialog';
import TableDataView from '../components/dbManager/TableDataView';
import FormDialog from '../components/FormDialog';

/* ── Group helpers ───────────────────────────────────────────────────────── */

const SYSTEM_TABLES = new Set([
  'overlays',
  'users',
  'app_settings',
  'user_emotes',
  'global_emotes',
  'registered_streamers',
  '_schemas',
]);

const LS_GROUPS_KEY = 'dbManager_tableGroups';
const LS_COLLAPSED_KEY = 'dbManager_groupCollapsed';

function loadFromLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function buildGroups(tables, tableGroups) {
  const map = {};
  for (const table of tables) {
    const group =
      tableGroups[table] ?? (SYSTEM_TABLES.has(table) ? 'system' : 'custom');
    if (!map[group]) map[group] = [];
    map[group].push(table);
  }
  return Object.keys(map)
    .sort((a, b) => {
      if (a === 'system') return -1;
      if (b === 'system') return 1;
      if (a === 'custom') return 1;
      if (b === 'custom') return -1;
      return a.localeCompare(b);
    })
    .map((name) => ({ name, tables: map[name] }));
}

/* ── Delete Confirm Dialog ────────────────────────────────────────────────── */

const ConfirmDeleteDialog = ({
  open,
  tableName,
  onClose,
  onConfirm,
  loading,
}) => (
  <FormDialog
    open={open}
    onClose={onClose}
    title="Delete Table"
    maxWidth="xs"
    actions={
      <>
        <Button variant="text" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
        >
          Delete
        </Button>
      </>
    }
  >
    <Typography>
      Are you sure you want to delete <strong>{tableName}</strong>? This action
      cannot be undone.
    </Typography>
  </FormDialog>
);

/* ── DatabaseManager ─────────────────────────────────────────────────────── */

const DatabaseManager = () => {
  const { showAlert } = useAlert();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [tableGroups, setTableGroups] = useState(() =>
    loadFromLS(LS_GROUPS_KEY, {}),
  );
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    loadFromLS(LS_COLLAPSED_KEY, {}),
  );
  const [groupPickerAnchor, setGroupPickerAnchor] = useState(null);
  const [groupPickerTable, setGroupPickerTable] = useState(null);
  const [groupPickerInput, setGroupPickerInput] = useState('');

  const toggleGroup = (groupName) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupName]: !prev[groupName] };
      saveToLS(LS_COLLAPSED_KEY, next);
      return next;
    });
  };

  const openGroupPicker = (e, tableName) => {
    e.stopPropagation();
    const current =
      tableGroups[tableName] ??
      (SYSTEM_TABLES.has(tableName) ? 'system' : 'custom');
    setGroupPickerAnchor(e.currentTarget);
    setGroupPickerTable(tableName);
    setGroupPickerInput(current);
  };

  const closeGroupPicker = () => {
    setGroupPickerAnchor(null);
    setGroupPickerTable(null);
  };

  const applyGroup = () => {
    const group = groupPickerInput.trim().toLowerCase();
    if (!group || !groupPickerTable) return closeGroupPicker();
    setTableGroups((prev) => {
      const next = { ...prev, [groupPickerTable]: group };
      saveToLS(LS_GROUPS_KEY, next);
      return next;
    });
    closeGroupPicker();
  };

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = currentUser?.roles?.includes('owner')
        ? await fetchAllTables()
        : await fetchTables();

      // Merge DB-stored groups for tables not yet overridden in localStorage
      const dbGroups = await fetchTableGroups().catch(() => null);
      if (dbGroups) {
        setTableGroups((prev) => {
          const merged = { ...prev };
          for (const [name, grp] of Object.entries(dbGroups)) {
            if (grp && !(name in merged)) merged[name] = grp;
          }
          saveToLS(LS_GROUPS_KEY, merged);
          return merged;
        });
      }

      // const visible = (all ?? []).filter((t) => !HIDDEN_TABLES.includes(t));
      setTables(all ?? []);
      setSelectedTable((prev) => {
        const safe = all ?? [];
        if (prev && safe.includes(prev)) return prev;
        return safe[0] ?? null;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      await deleteTable(deleteTarget);
      showAlert({
        message: `Table "${deleteTarget}" deleted`,
        severity: 'success',
      });
      if (selectedTable === deleteTarget) setSelectedTable(null);
      setTableGroups((prev) => {
        const next = { ...prev };
        delete next[deleteTarget];
        saveToLS(LS_GROUPS_KEY, next);
        return next;
      });
      setDeleteTarget(null);
      await loadTables();
    } catch (e) {
      showAlert({ message: e.message, severity: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCreated = ({ tableName, group } = {}) => {
    if (tableName && group) {
      setTableGroups((prev) => {
        const next = { ...prev, [tableName]: group };
        saveToLS(LS_GROUPS_KEY, next);
        return next;
      });
    }
    loadTables();
  };

  const existingGroups = [...new Set(Object.values(tableGroups))].filter(
    Boolean,
  );

  return (
    <Layout>
      <Sidebar>
        <SidebarHeader>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon sx={{ fontSize: 16, color: '#309abd' }} />
            <Typography variant="body2" fontWeight={700}>
              Tables
            </Typography>
          </Box>
        </SidebarHeader>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Table list */}
        <TableList>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
              <CircularProgress size={20} sx={{ opacity: 0.4 }} />
            </Box>
          )}
          {!loading && error && (
            <Alert severity="error" sx={{ m: 1 }}>
              {error}
            </Alert>
          )}
          {!loading && !error && tables.length === 0 && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: 'block', px: 2, pt: 2 }}
            >
              No tables yet.
            </Typography>
          )}
          {!loading &&
            !error &&
            buildGroups(tables, tableGroups).map(
              ({ name: groupName, tables: groupItems }) => (
                <React.Fragment key={groupName}>
                  <GroupHeader onClick={() => toggleGroup(groupName)}>
                    {collapsedGroups[groupName] ? (
                      <KeyboardArrowRightIcon
                        sx={{ fontSize: 14, opacity: 0.4 }}
                      />
                    ) : (
                      <KeyboardArrowDownIcon
                        sx={{ fontSize: 14, opacity: 0.4 }}
                      />
                    )}
                    <Typography
                      variant="caption"
                      sx={{
                        flex: 1,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.8,
                        fontSize: 10,
                        opacity: 0.45,
                      }}
                    >
                      {groupName}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.25, fontSize: 10 }}
                    >
                      {groupItems.length}
                    </Typography>
                  </GroupHeader>
                  {!collapsedGroups[groupName] &&
                    groupItems.map((table) => (
                      <TableRow
                        key={table}
                        className={selectedTable === table ? 'active' : ''}
                        onClick={() => setSelectedTable(table)}
                      >
                        <Typography
                          variant="body2"
                          sx={{ flex: 1, fontSize: 13 }}
                          noWrap
                        >
                          {table}
                        </Typography>
                        {!SYSTEM_TABLES.has(table) && (
                          <Tooltip title="Move to group">
                            <IconButton
                              size="small"
                              className="action-btn"
                              onClick={(e) => openGroupPicker(e, table)}
                              sx={{
                                color: 'rgba(255,255,255,0.2)',
                                '&:hover': {
                                  color: '#309abd',
                                  bgcolor: 'rgba(48,154,189,0.1)',
                                },
                              }}
                            >
                              <FolderIcon sx={{ fontSize: 12 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete table">
                          <IconButton
                            size="small"
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(table);
                            }}
                            sx={{
                              color: 'rgba(255,255,255,0.2)',
                              '&:hover': {
                                color: '#ff6b6b',
                                bgcolor: 'rgba(255,80,80,0.1)',
                              },
                            }}
                          >
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </TableRow>
                    ))}
                </React.Fragment>
              ),
            )}
        </TableList>

        <SidebarFooter>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 1 }} />
          <Button
            fullWidth
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ fontSize: 12 }}
          >
            New Table
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <ContentArea>
        {/* Page header */}
        <ContentHeader>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <StorageIcon sx={{ color: '#309abd', fontSize: 26 }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Database Manager
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tables.length} custom table{tables.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
        </ContentHeader>

        {/* Data view */}
        <DataArea>
          {!selectedTable ? (
            <EmptyState>
              <StorageIcon sx={{ fontSize: 52, opacity: 0.12, mb: 1.5 }} />
              <Typography color="text.secondary" variant="body2">
                Select a table from the sidebar or create a new one.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
                sx={{ mt: 1.5 }}
              >
                Create Table
              </Button>
            </EmptyState>
          ) : (
            <TableDataView key={selectedTable} tableName={selectedTable} />
          )}
        </DataArea>
      </ContentArea>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <CreateTableDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
        existingGroups={existingGroups}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        tableName={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />

      {/* Group assignment picker */}
      <Popover
        open={Boolean(groupPickerAnchor)}
        anchorEl={groupPickerAnchor}
        onClose={closeGroupPicker}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, width: 210 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            Assign to group
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {[
              ...new Set(['system', 'custom', ...Object.values(tableGroups)]),
            ].map((g) => (
              <Chip
                key={g}
                label={g}
                size="small"
                clickable
                onClick={() => setGroupPickerInput(g)}
                color={groupPickerInput === g ? 'primary' : 'default'}
                sx={{ fontSize: 10 }}
              />
            ))}
          </Box>
          <TextField
            size="small"
            placeholder="Group name"
            value={groupPickerInput}
            onChange={(e) => setGroupPickerInput(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === 'Enter' && applyGroup()}
            autoFocus
            fullWidth
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
            <Button size="small" onClick={closeGroupPicker}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={applyGroup}>
              Apply
            </Button>
          </Box>
        </Box>
      </Popover>
    </Layout>
  );
};

export default DatabaseManager;

/* ── Styled ──────────────────────────────────────────────────────────────── */

const SIDEBAR_W = 220;

const Layout = styled.div`
  display: flex;
  height: 100%;
  overflow: hidden;
`;

const Sidebar = styled.aside`
  width: ${SIDEBAR_W}px;
  min-width: ${SIDEBAR_W}px;
  display: flex;
  flex-direction: column;
  background: #101019;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
`;

const TableList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px 4px;
  cursor: pointer;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
`;

const TableRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px 7px 20px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
  user-select: none;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  &:hover .delete-btn,
  &:hover .action-btn,
  &.active .delete-btn,
  &.active .action-btn {
    opacity: 1;
  }

  .delete-btn,
  .action-btn {
    opacity: 0;
    transition: opacity 0.12s ease;
  }

  &.active {
    background: rgba(48, 154, 189, 0.12);
    border-left-color: #309abd;

    p {
      font-weight: 600;
      color: #fff;
    }
  }
`;

const SidebarFooter = styled.div`
  padding: 8px 12px 12px;
`;

const ContentArea = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0c0c14;
`;

const ContentHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
`;

const DataArea = styled.div`
  flex: 1;
  overflow: auto;
  padding: 24px 28px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
`;
