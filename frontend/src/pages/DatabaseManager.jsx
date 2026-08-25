import React, { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import StorageIcon from '@mui/icons-material/Storage';
import { fetchTables, deleteTable } from '../api/customTablesApi';
import { useAlert } from '../contexts/AlertContext';
import CreateTableDialog from '../components/dbManager/CreateTableDialog';
import TableDataView from '../components/dbManager/TableDataView';
import FormDialog from '../components/FormDialog';

const HIDDEN_TABLES = ['users', 'overlays', 'app_settings'];

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

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const all = await fetchTables();
      // TODO Add all tables if the user is the owner, otherwise filter the HIDDEN_TABLES out.
      const visible = (all ?? []).filter((t) => !HIDDEN_TABLES.includes(t));
      setTables(visible);
      setSelectedTable((prev) => {
        if (prev && visible.includes(prev)) return prev;
        return visible[0] ?? null;
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
      setDeleteTarget(null);
      await loadTables();
    } catch (e) {
      showAlert({ message: e.message, severity: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Layout>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
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
          {tables.map((table) => (
            <TableRow
              key={table}
              className={selectedTable === table ? 'active' : ''}
              onClick={() => setSelectedTable(table)}
            >
              <Typography variant="body2" sx={{ flex: 1, fontSize: 13 }} noWrap>
                {table}
              </Typography>
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
        onCreated={loadTables}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        tableName={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />
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

const TableRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
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
  &.active .delete-btn {
    opacity: 1;
  }

  .delete-btn {
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
